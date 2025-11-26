import driver from "../config/neo4j.js";

/**
 * Returns nodes and relationships around a user:
 * - direct transaction links (SENT/RECEIVED_BY)
 * - shared attribute links (same email/phone/address/paymentMethods)
 *
 * Response format: { nodes: [...], relationships: [...] }
 */
export async function getUserGraph(userId) {
  const session = driver.session();
  try {
    const query = `
      MATCH (u:User {id: $userId})
      OPTIONAL MATCH (u)-[r1]->(t:Transaction)
      OPTIONAL MATCH (t)-[r2]->(otherUser:User)
      OPTIONAL MATCH (u)-[r3]-(other:User)
      WHERE other.id <> $userId
      RETURN u, collect(DISTINCT t) AS transactions, collect(DISTINCT otherUser) AS otherUsers, collect(DISTINCT other) AS sharedUsers
    `;
    const res = await session.run(query, { userId });
    if (res.records.length === 0) return { nodes: [], relationships: [] };

    const rec = res.records[0];
    const u = rec.get("u").properties;
    const transactions = rec.get("transactions").map(n => n.properties);
    const otherUsers = rec.get("otherUsers").map(n => n.properties);
    const sharedUsers = rec.get("sharedUsers").map(n => n.properties);

    // Build nodes & relationships for response (simple format)
    const nodes = [
      { id: `user-${u.id}`, label: u.id, type: "User", props: u }
    ];
    const relationships = [];

    transactions.forEach(tx => {
      nodes.push({ id: `tx-${tx.id}`, label: tx.id, type: "Transaction", props: tx });
      relationships.push({ from: `user-${u.id}`, to: `tx-${tx.id}`, type: "SENT/RECEIVED" });
    });

    otherUsers.forEach(o => {
      nodes.push({ id: `user-${o.id}`, label: o.id, type: "User", props: o });
      relationships.push({ from: `user-${u.id}`, to: `user-${o.id}`, type: "DIRECT" });
    });

    sharedUsers.forEach(s => {
      nodes.push({ id: `user-${s.id}`, label: s.id, type: "User", props: s });
      relationships.push({ from: `user-${u.id}`, to: `user-${s.id}`, type: "SHARED_ATTRIBUTE" });
    });

    // dedupe nodes by id
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));
    const uniqueNodes = [...nodeMap.values()];

    return { nodes: uniqueNodes, relationships };
  } finally {
    await session.close();
  }
}

/**
 * Returns nodes and relationships around a transaction:
 * - linked users
 * - linked transactions via SAME_IP / SAME_DEVICE
 */
export async function getTransactionGraph(txId) {
  const session = driver.session();
  try {
    const query = `
      MATCH (t:Transaction {id: $txId})
      OPTIONAL MATCH (u1:User)-[s:SENT]->(t)
      OPTIONAL MATCH (t)-[r:RECEIVED_BY]->(u2:User)
      OPTIONAL MATCH (t)-[:SAME_IP|:SAME_DEVICE]-(other:Transaction)
      RETURN t, collect(DISTINCT u1) AS senders, collect(DISTINCT u2) AS receivers, collect(DISTINCT other) AS others
    `;
    const res = await session.run(query, { txId });
    if (res.records.length === 0) return { nodes: [], relationships: [] };

    const rec = res.records[0];
    const t = rec.get("t").properties;
    const senders = rec.get("senders").map(n => n.properties);
    const receivers = rec.get("receivers").map(n => n.properties);
    const others = rec.get("others").map(n => n.properties);

    const nodes = [{ id: `tx-${t.id}`, label: t.id, type: "Transaction", props: t }];
    const relationships = [];

    senders.forEach(s => {
      nodes.push({ id: `user-${s.id}`, label: s.id, type: "User", props: s });
      relationships.push({ from: `user-${s.id}`, to: `tx-${t.id}`, type: "SENT" });
    });
    receivers.forEach(r => {
      nodes.push({ id: `user-${r.id}`, label: r.id, type: "User", props: r });
      relationships.push({ from: `tx-${t.id}`, to: `user-${r.id}`, type: "RECEIVED_BY" });
    });
    others.forEach(o => {
      nodes.push({ id: `tx-${o.id}`, label: o.id, type: "Transaction", props: o });
      relationships.push({ from: `tx-${t.id}`, to: `tx-${o.id}`, type: "LINKED" });
    });

    // dedupe nodes
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));
    const uniqueNodes = [...nodeMap.values()];

    return { nodes: uniqueNodes, relationships };
  } finally {
    await session.close();
  }
}
