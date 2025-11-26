import neo4j from "neo4j-driver";

const NEO4J_URI =
  process.env.NEO4J_URI || "bolt://localhost:7687"; // CHANGED
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASS = process.env.NEO4J_PASS || "password";

// For Neo4j Desktop (NO SSL):
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASS),
  { encrypted: "ENCRYPTION_OFF" } // IMPORTANT FIX
);

export default driver;
