import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import {
  assertTargetUser,
  requireUserOrAgent,
  type AuthedRequest,
} from "../middleware/auth.js";

const router = Router();

/** Photon agent: undelivered rows + where to send (from user profile). */
router.get("/notifications/pending/:userId", requireUserOrAgent, async (req: AuthedRequest, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  if (!assertTargetUser(req, userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: user, error: uerr } = await supabase
    .from("users")
    .select("notification_imessage_to")
    .eq("id", userId)
    .single();

  if (uerr || !user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { data: rows, error } = await supabase
    .from("notification_outbox")
    .select("id, body, created_at")
    .eq("user_id", userId)
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("pending notifications", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({
    deliverTo: user.notification_imessage_to?.trim() || null,
    notifications: rows ?? [],
  });
});

router.post("/notifications/:id/ack", requireUserOrAgent, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId required in body" });
  }

  if (!assertTargetUser(req, userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("notification_outbox")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !row || row.user_id !== userId) {
    return res.status(404).json({ error: "Not found" });
  }

  const { error: upErr } = await supabase
    .from("notification_outbox")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (upErr) {
    return res.status(500).json({ error: upErr.message });
  }

  res.json({ ok: true });
});

export default router;
