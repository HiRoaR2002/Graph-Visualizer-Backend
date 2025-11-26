import express from "express";
import * as userService from "../services/user.service.js";

const router = express.Router();

// POST /users - add or update user
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const user = await userService.upsertUser(payload);
    res.status(201).json(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to upsert user", details: err.message });
  }
});

// GET /users - list users (supports ?limit=&skip=)
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const skip = parseInt(req.query.skip || "0", 10);
    const users = await userService.listUsers({ limit, skip });
    res.json(users);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to list users", details: err.message });
  }
});

export default router;
