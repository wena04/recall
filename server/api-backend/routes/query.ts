import { Router } from "express";
import { handleQuery } from "../services/rag";

const router = Router();

router.post("/query", async (req, res) => {
  const { userId, question } = req.body;

  if (!userId || !question) {
    return res.status(400).json({ error: "userId and question are required" });
  }

  try {
    const answer = await handleQuery(userId, question);
    res.json({ answer });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error handling query:", error);
    const dev = process.env.NODE_ENV !== "production";
    res.status(500).json({ error: dev ? msg : "Internal server error" });
  }
});

export default router;
