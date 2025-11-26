import express from "express";
import * as relService from "../services/relationship.service.js";

const router = express.Router();

/**
 * GET /relationships/user/:id
 * Returns nodes and relationships connected to a user (direct & shared attrs)
 */
router.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const graph = await relService.getUserGraph(id);
    res.json(graph);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user relationships", details: err.message });
  }
});

/**
 * GET /relationships/transaction/:id
 * Returns nodes and relationships connected to a transaction
 */
router.get("/transaction/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const graph = await relService.getTransactionGraph(id);
    res.json(graph);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transaction relationships", details: err.message });
  }
});

export default router;
