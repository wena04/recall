/**
 * Polls Second Brain for pending location-based messages and sends them via Photon.
 * Run on Mac next to Messages (Full Disk Access). Dashboard must POST /api/location with frequency on.
 *
 *   npm run agent:notify-poll
 *
 * Env: SECOND_BRAIN_API_URL, SECOND_BRAIN_USER_ID, NOTIFY_POLL_INTERVAL_MS (default 30000)
 */
import "./load-agent-env.js";
import { IMessageSDK } from "@photon-ai/imessage-kit";

const api = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, "");
const userId = process.env.SECOND_BRAIN_USER_ID;
const intervalMs = parseInt(process.env.NOTIFY_POLL_INTERVAL_MS || "30000", 10);

if (!api || !userId) {
  console.error("Set SECOND_BRAIN_API_URL and SECOND_BRAIN_USER_ID");
  process.exit(1);
}

const sdk = new IMessageSDK({ debug: false });

async function tick(): Promise<void> {
  try {
    const res = await fetch(`${api}/api/notifications/pending/${userId}`);
    if (!res.ok) {
      console.warn("notify-poll pending HTTP", res.status);
      return;
    }
    const j = (await res.json()) as {
      deliverTo?: string | null;
      notifications?: Array<{ id: string; body: string }>;
    };
    const to = j.deliverTo?.trim();
    const list = j.notifications ?? [];
    if (!to || list.length === 0) return;

    for (const n of list) {
      await sdk.send(to, `📍 Recall\n\n${n.body}`);
      const ack = await fetch(`${api}/api/notifications/${n.id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!ack.ok) {
        console.warn("ack failed", n.id, ack.status);
      } else {
        console.log("Sent + ack", n.id);
      }
    }
  } catch (e) {
    console.error("notify-poll", e);
  }
}

console.log(`📬 notify-poll every ${intervalMs}ms → ${api}`);
await tick();
setInterval(tick, intervalMs);

process.on("SIGINT", async () => {
  await sdk.close();
  process.exit(0);
});
