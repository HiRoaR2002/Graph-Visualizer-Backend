/**
 * Small test dataset generator
 * - 8 Users (with shared email/phone/IP to create user-to-user links)
 * - 12 Transactions
 * - 2–3 SAME_IP and SAME_DEVICE links
 */

import driver from "../config/neo4j.js";
import { randomUUID } from "crypto";

const USERS_COUNT = 8;
const TX_COUNT = 12;

async function createUsers() {
  const session = driver.session();

  // Shared attributes to force user-to-user linking
  const sharedEmails = ["sharedA@example.com", "sharedB@example.com"];
  const sharedPhones = ["9990000001", "9990000002"];

  const users = Array.from({ length: USERS_COUNT }).map((_, i) => ({
    id: `user-${i + 1}`,
    name: `User ${i + 1}`,
    email: i < 3 ? sharedEmails[0] : i < 5 ? sharedEmails[1] : `user${i}@example.com`,
    phone: i < 4 ? sharedPhones[0] : i < 6 ? sharedPhones[1] : `900000${i}`,
    address: `Address ${i + 1}`,
    paymentMethods: ["card", ...(i % 3 === 0 ? ["upi"] : [])],
  }));

  const query = `
    UNWIND $users AS u
    MERGE (n:User {id: u.id})
    SET n.name = u.name,
        n.email = u.email,
        n.phone = u.phone,
        n.address = u.address,
        n.paymentMethods = u.paymentMethods
  `;

  await session.run(query, { users });
  await session.close();

  console.log("Created Users:", users.length);
  return users;
}

async function createTransactions(users) {
  const session = driver.session();

  const ipPool = ["10.0.0.1", "10.0.0.5", "192.168.1.10"];
  const devicePool = ["device-1", "device-2", "device-5"];

  const txs = Array.from({ length: TX_COUNT }).map(() => {
    const sender = users[Math.floor(Math.random() * users.length)];
    let receiver = users[Math.floor(Math.random() * users.length)];
    if (receiver.id === sender.id)
      receiver = users[(Math.floor(Math.random() * users.length) + 1) % users.length];

    return {
      id: randomUUID(),
      amount: Math.floor(Math.random() * 10000) / 100,
      timestamp: Date.now(),
      senderId: sender.id,
      receiverId: receiver.id,
      ip: ipPool[Math.floor(Math.random() * ipPool.length)],
      deviceId: devicePool[Math.floor(Math.random() * devicePool.length)]
    };
  });

  // Create tx nodes + relationships
  const query = `
    UNWIND $txs AS tx
    MERGE (t:Transaction {id: tx.id})
    SET t.amount = tx.amount,
        t.timestamp = tx.timestamp,
        t.ip = tx.ip,
        t.deviceId = tx.deviceId
    WITH tx, t
    MATCH (s:User {id: tx.senderId})
    MATCH (r:User {id: tx.receiverId})
    MERGE (s)-[:SENT]->(t)
    MERGE (t)-[:RECEIVED_BY]->(r)
  `;
  await session.run(query, { txs });

  // 2–3 SAME_IP links
  await session.run(
    `
    UNWIND $txs AS tx
    MATCH (t:Transaction {id: tx.id})
    MATCH (other:Transaction)
    WHERE other.ip = tx.ip AND other.id <> tx.id
    WITH t, other LIMIT 3
    MERGE (t)-[:SAME_IP]->(other)
    `,
    { txs }
  );

  // 2–3 SAME_DEVICE links
  await session.run(
    `
    UNWIND $txs AS tx
    MATCH (t:Transaction {id: tx.id})
    MATCH (other:Transaction)
    WHERE other.deviceId = tx.deviceId AND other.id <> tx.id
    WITH t, other LIMIT 3
    MERGE (t)-[:SAME_DEVICE]->(other)
    `,
    { txs }
  );

  console.log("Created Transactions:", txs.length);
  await session.close();
}

(async () => {
  console.log("Generating small test dataset...");
  const users = await createUsers();
  await createTransactions(users);
  console.log("✔ Small dataset created successfully!");
  process.exit(0);
})();
