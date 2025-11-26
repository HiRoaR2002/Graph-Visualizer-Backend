import driver from "../config/neo4j.js";

/**
 * Upsert a user node.
 * Accepts payload with id (optional), name, email, phone, address, paymentMethods (array)
 */
export async function upsertUser(payload) {
  const session = driver.session();
  try {
    const id = payload.id || payload.userId || `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const params = {
      id,
      name: payload.name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      address: payload.address || null,
      paymentMethods: payload.paymentMethods || []
    };

    const query = `
      MERGE (u:User {id: $id})
      SET u.name = $name,
          u.email = $email,
          u.phone = $phone,
          u.address = $address,
          u.paymentMethods = $paymentMethods
      RETURN u
    `;

    const result = await session.run(query, params);
    const record = result.records[0];
    return record ? record.get("u").properties : null;
  } finally {
    await session.close();
  }
}

export async function listUsers({ limit = 100, skip = 0 } = {}) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User) RETURN u ORDER BY u.id SKIP $skip LIMIT $limit`,
      { limit: neo4jInt(limit), skip: neo4jInt(skip) }
    );
    return result.records.map(r => r.get("u").properties);
  } finally {
    await session.close();
  }
}

import { int as neo4jInt } from "neo4j-driver";
