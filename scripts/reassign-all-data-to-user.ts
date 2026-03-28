import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TARGET_EMAIL = (process.env.TARGET_EMAIL ?? "wena04@uw.edu").toLowerCase();
const DRY_RUN =
  (process.env.DRY_RUN ?? "false").toLowerCase() === "true" ||
  process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getTargetUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;

  const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!found) throw new Error(`Target email not found in auth.users: ${email}`);
  return found.id;
}

async function countRowsToMove(table: "knowledge_items" | "notification_outbox", targetUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .neq("user_id", targetUserId);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const targetUserId = await getTargetUserIdByEmail(TARGET_EMAIL);
  console.log(`Target account: ${TARGET_EMAIL}`);
  console.log(`Target user id: ${targetUserId}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const toMoveKnowledge = await countRowsToMove("knowledge_items", targetUserId);
  const toMoveOutbox = await countRowsToMove("notification_outbox", targetUserId);

  console.log(`knowledge_items rows to move: ${toMoveKnowledge}`);
  console.log(`notification_outbox rows to move: ${toMoveOutbox}`);

  if (DRY_RUN) return;

  const nowIso = new Date().toISOString();
  const { error: upsertUserErr } = await supabase
    .from("users")
    .upsert({ id: targetUserId, updated_at: nowIso }, { onConflict: "id" });
  if (upsertUserErr) throw upsertUserErr;

  if (toMoveKnowledge > 0) {
    const { error } = await supabase
      .from("knowledge_items")
      .update({ user_id: targetUserId })
      .neq("user_id", targetUserId);
    if (error) throw error;
  }

  if (toMoveOutbox > 0) {
    const { error } = await supabase
      .from("notification_outbox")
      .update({ user_id: targetUserId })
      .neq("user_id", targetUserId);
    if (error) throw error;
  }

  const movedKnowledgeAfter = await countRowsToMove("knowledge_items", targetUserId);
  const movedOutboxAfter = await countRowsToMove("notification_outbox", targetUserId);
  console.log(`Remaining non-target knowledge_items: ${movedKnowledgeAfter}`);
  console.log(`Remaining non-target notification_outbox: ${movedOutboxAfter}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
