/**
 * Bulk data generation:
 * - Creates N_USERS users
 * - Generates TOTAL_TX transactions and links them to users
 *
 * This script uses batching with UNWIND to create many nodes/relationships efficiently.
 *
 * Usage:
 *   node src/scripts/generateData.js
 *
 * Environment:
 *   NEO4J_URI, NEO4J_USER, NEO4J_PASS (optional; defaults used in config)
 */

import driver from "../config/neo4j.js";
import { randomUUID } from "crypto";

const TOTAL_TX = parseInt(process.env.TOTAL_TX || "100000", 10);
const N_USERS = parseInt(process.env.N_USERS || "1000", 10);
const BATCH = parseInt(process.env.BATCH || "1000", 10); // transactions per batch

async function createUsers(n) {
  const session = driver.session();
  try {
    const users = [];
    for (let i = 0; i < n; i++) {
      users.push({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        phone: `90000${String(i).padStart(5, "0")}`,
        name: `User ${i}`,
        address: `Address ${i}`,
        paymentMethods: ["card", ...(i % 5 === 0 ? ["upi"] : [])]
      });
    }

    const query = `
      UNWIND $users AS u
      MERGE (n:User {id: u.id})
      SET n.email = u.email, n.phone = u.phone, n.name = u.name, n.address = u.address, n.paymentMethods = u.paymentMethods
    `;
    await session.run(query, { users });
    console.log(`Created ${n} users`);
    return users;
  } finally {
    await session.close();
  }
}

async function createTransactions(users, totalTx, batchSize) {
  const session = driver.session();
  try {
    const nBatches = Math.ceil(totalTx / batchSize);
    console.log(`Creating ${totalTx} transactions in ${nBatches} batches (batch size ${batchSize})`);

    for (let b = 0; b < nBatches; b++) {
      const start = b * batchSize;
      const remaining = Math.min(batchSize, totalTx - start);
      const txs = [];

      for (let i = 0; i < remaining; i++) {
        const id = randomUUID();
        const amount = Math.floor(Math.random() * 50000) / 100;
        const senderIdx = Math.floor(Math.random() * users.length);
        let receiverIdx = Math.floor(Math.random() * users.length);
        if (receiverIdx === senderIdx) receiverIdx = (receiverIdx + 1) % users.length;

        // create some shared IPs/devices intentionally for linking
        const ipPool = [`10.0.0.${(b % 250) + 1}`, `172.16.0.${(b % 250) + 1}`, `192.168.1.${(b % 250) + 1}`];
        const devicePool = [`device-${(b % 500) + 1}`, `device-${((b + 7) % 500) + 1}`];

        txs.push({
          id,
          amount,
          timestamp: Date.now(),
          senderId: users[senderIdx].id,
          receiverId: users[receiverIdx].id,
          ip: ipPool[Math.floor(Math.random() * ipPool.length)],
          deviceId: devicePool[Math.floor(Math.random() * devicePool.length)]
        });
      }

      // Use UNWIND to create tx nodes + relationships in one transaction
      const query = `
        UNWIND $txs AS tx
        MERGE (t:Transaction {id: tx.id})
        SET t.amount = tx.amount, t.timestamp = tx.timestamp, t.ip = tx.ip, t.deviceId = tx.deviceId
        WITH tx, t
        MATCH (s:User {id: tx.senderId})
        MATCH (r:User {id: tx.receiverId})
        MERGE (s)-[:SENT]->(t)
        MERGE (t)-[:RECEIVED_BY]->(r)
      `;
      await session.run(query, { txs });

      // Create transaction-to-transaction SAME_IP / SAME_DEVICE links within batch (limited)
      const linkQuery = `
        UNWIND $txs AS tx
        MATCH (t:Transaction {id: tx.id})
        WITH t, tx
        // link to up to 20 existing transactions sharing same ip
        MATCH (other:Transaction) WHERE other.ip = tx.ip AND other.id <> tx.id
        WITH t, other LIMIT 20
        MERGE (t)-[:SAME_IP]->(other)
      `;
      await session.run(linkQuery, { txs });

      const linkQuery2 = `
        UNWIND $txs AS tx
        MATCH (t:Transaction {id: tx.id})
        WITH t, tx
        MATCH (other:Transaction) WHERE other.deviceId = tx.deviceId AND other.id <> tx.id
        WITH t, other LIMIT 20
        MERGE (t)-[:SAME_DEVICE]->(other)
      `;
      await session.run(linkQuery2, { txs });

      console.log(`Batch ${b + 1}/${nBatches} created (${remaining} transactions)`);
    }
  } finally {
    await session.close();
  }
}

(async () => {
  try {
    console.log("Starting data generation...");
    const users = await createUsers(N_USERS);
    await createTransactions(users, TOTAL_TX, BATCH);
    console.log("Data generation complete.");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Data generation failed:", err);
  } finally {
    await driver.close();
    process.exit(0);
  }
})();
