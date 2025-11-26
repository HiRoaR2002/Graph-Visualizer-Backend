import express from "express";
import cors from "cors";
import usersRouter from "./routes/users.js";
import transactionsRouter from "./routes/transactions.js";
import relationshipsRouter from "./routes/relationships.js";
import "dotenv/config";
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({
  origin: "*", // or specify Vercel domain later
}));

app.use(express.json({ limit: "5mb" }));
const neo4j = process.env.NEO4J_URI;

// console.log("neo URL", neo4j)
// API routes
app.use("/users", usersRouter);
app.use("/transactions", transactionsRouter);
app.use("/relationships", relationshipsRouter);

// health
app.get("/", (req, res) => res.json({ status: "ok", timestamp: Date.now() }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${PORT}`);
});
