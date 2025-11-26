import driver from "../config/neo4j.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create transaction and connect sender/receiver users.
 * payload: { id (optional), amount, timestamp, senderId, receiverId, ip, deviceId, metadata }
 */
export async function createTransaction(payload) {
  const session = driver.session();
  try {
    const id = payload.id || uuidv4();
    const amount = payload.amount != null ? payload.amount : 0;
    const timestamp = payload.timestamp || Date.now();

    const params = {
      id,
      amount,
      timestamp,
      ip: payload.ip || null,
      deviceId: payload.deviceId || null,
      metadata: payload.metadata || {}
    };

    // CREATE transaction node and link to sender/receiver (if they exist)
    const query = `
      MERGE (t:Transaction {id: $id})
      SET t.amount = $amount, t.timestamp = $timestamp, t.ip = $ip, t.deviceId = $deviceId, t.metadata = $metadata
      WITH t
      OPTIONAL MATCH (s:User {id: $senderId})
      OPTIONAL MATCH (r:User {id: $receiverId})
      FOREACH (_ IN CASE WHEN s IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s)-[:SENT]->(t)
      )
      FOREACH (_ IN CASE WHEN r IS NOT NULL THEN [1] ELSE [] END |
        MERGE (t)-[:RECEIVED_BY]->(r)
      )
      RETURN t
    `;

    const paramsWithUsers = {
      ...params,
      senderId: payload.senderId || null,
      receiverId: payload.receiverId || null
    };

    await session.run(query, paramsWithUsers);

    // Link transaction-to-transaction by shared ip/deviceId (if present)
    if (params.ip) {
      const q = `
        MATCH (t:Transaction {id: $id})
        MATCH (o:Transaction) WHERE o.ip = $ip AND o.id <> $id
        WITH t, o LIMIT 50
        MERGE (t)-[:SAME_IP]->(o)
      `;
      await session.run(q, { id, ip: params.ip });
    }
    if (params.deviceId) {
      const q2 = `
        MATCH (t:Transaction {id: $id})
        MATCH (o:Transaction) WHERE o.deviceId = $deviceId AND o.id <> $id
        WITH t, o LIMIT 50
        MERGE (t)-[:SAME_DEVICE]->(o)
      `;
      await session.run(q2, { id, deviceId: params.deviceId });
    }

    // Return the transaction node
    const ret = await session.run(`MATCH (t:Transaction {id: $id}) RETURN t`, { id });
    const rec = ret.records[0];
    return rec ? rec.get("t").properties : null;
  } finally {
    await session.close();
  }
}

export async function listTransactions({ limit = 100, skip = 0 } = {}) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (t:Transaction) RETURN t ORDER BY t.timestamp DESC SKIP $skip LIMIT $limit`,
      { limit: neo4jInt(limit), skip: neo4jInt(skip) }
    );
    return result.records.map(r => r.get("t").properties);
  } finally {
    await session.close();
  }
}

export async function countTransactions() {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (t:Transaction)
      RETURN count(t) AS count
    `);
    return result.records[0].get("count").toInt();
  } finally {
    await session.close();
  }
}

export async function exportAllTransactions() {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (t:Transaction)
      RETURN t
    `);
    return result.records.map(r => r.get("t").properties);
  } finally {
    await session.close();
  }
}


import { int as neo4jInt } from "neo4j-driver";
