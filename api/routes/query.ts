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
    console.error("Error handling query:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
