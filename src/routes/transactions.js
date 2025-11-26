import express from "express";
import * as txService from "../services/transaction.service.js";

const router = express.Router();

/* =========================
   CREATE / UPSERT TRANSACTION
   ========================= */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const tx = await txService.createTransaction(payload);
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to create transaction",
      details: err.message
    });
  }
});

/* =========================
   LIST TRANSACTIONS (paginated)
   ========================= */
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const skip = parseInt(req.query.skip || "0", 10);
    const txs = await txService.listTransactions({ limit, skip });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to list transactions",
      details: err.message
    });
  }
});

/* =========================
   TOTAL COUNT (needed for UI)
   ========================= */
router.get("/count", async (req, res) => {
  try {
    const count = await txService.countTransactions();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to count transactions",
      details: err.message
    });
  }
});

/* =========================
   EXPORT ALL (optional)
   ========================= */
router.get("/export", async (req, res) => {
  try {
    const allTx = await txService.exportAllTransactions();
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.json"
    );
    res.send(JSON.stringify(allTx));
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to export transactions",
      details: err.message
    });
  }
});

export default router;
