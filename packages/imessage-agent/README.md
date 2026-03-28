# Photon / iMessage agent — hackathon path (macOS)

This package uses [**@photon-ai/imessage-kit**](https://github.com/photon-hq/imessage-kit) to read iMessage history and optionally forward transcripts to the Second Brain API (`POST /api/message`).

## Prerequisites

- **macOS** (Photon does not run on Windows/Linux for iMessage).
- **Node.js ≥ 18**.
- **Full Disk Access** — required to read `~/Library/Messages/chat.db`:
  **System Settings → Privacy & Security → Full Disk Access** → add the app that **runs Node**:
  - **Cursor:** add **`Cursor.app`** (integrated terminal = Cursor process, not only `node`).
  - **Terminal.app / iTerm:** add that app if you run commands there.
  - Toggle off/on, then **quit and reopen** the app before `npm run agent:test:imessage` again.

### `unable to open database file` / `chat.db`

This is **permissions**, not a broken npm package. Follow Full Disk Access above. Do **not** delete `@photon-ai/imessage-kit`.

## 1. Install dependencies

From the **repo root**:

```bash
npm install
```

## 2. Verify the SDK can read Messages

```bash
npm run agent:test:imessage
```

You should see chats listed and a few recent messages. If you get permission errors, fix Full Disk Access and try again.

## 3. Configure Second Brain ingest (optional but recommended)

Copy env and fill in values:

```bash
cp packages/imessage-agent/.env.example packages/imessage-agent/.env
```

| Variable | Purpose |
|----------|---------|
| `RECALL_TRIGGER` | Substring that triggers the agent (default `recall`). |
| `MAX_MESSAGES` | Max messages pulled **for the current thread** (default `400`). |
| `RECALL_GROUP_NAME_CONTAINS` | Optional. Comma-separated substrings; if set, **only group chats** whose **display name** matches respond (e.g. `INFO 340,INFO 330`). Empty = any DM/group. |
| `RECALL_DEMO_HINT` | Extra context sent to MiniMax (course names, demo story). |
| `CHAT_LABEL_REFRESH_MS` | How often to refresh `listChats` cache (default `300000`). |
| `SECOND_BRAIN_INGEST_ON_RECALL` | `true` → transcript → **MiniMax** → **Supabase**; iMessage reply uses that summary + keywords/style. |
| `SECOND_BRAIN_API_URL` | e.g. `http://localhost:3001` (API must be running). |
| `SECOND_BRAIN_USER_ID` | Supabase **`auth.users.id`** UUID (same user as the web app / `VITE_DEV_USER_ID` in dev bypass). |

**Not “training” models:** each ingest runs **inference** and stores structured rows (`summary`, `persona`, `recall_enrichment` JSON). You can later **retrieve** those rows into prompts (RAG-style)—that is not fine-tuning MiniMax on your DB.

Get a dev user UUID:

```bash
npm run dev:ensure-user
# or copy from Supabase Dashboard → Authentication → Users
```

## 4. Run the API + agent

**Terminal A — Second Brain API + web (from repo root):**

```bash
npm run dev
```

**Terminal B — Photon agent:**

```bash
npm run agent:start
```

### Multi-chat ingest without iMessage (testing / backfill)

Same pipeline as typing **`recall all`** in a thread, but runs once from the terminal and exits (good for populating the DB).

**Terminal A:** `npm run dev` (API must be reachable).

**Terminal B (macOS, Full Disk Access):**

```bash
npm run agent:scan-all
```

Uses `SECOND_BRAIN_API_URL`, `SECOND_BRAIN_USER_ID`, and optional `RECALL_MAX_CHATS_SCAN`, `RECALL_MESSAGES_PER_CHAT_SCAN`, `RECALL_INGEST_DELAY_MS`, `RECALL_GROUP_NAME_CONTAINS`, `RECALL_DEMO_HINT` from **`packages/imessage-agent/.env`** (repo root `.env` is also loaded first for shared vars).

**Debug empty scans:** set `RECALL_SCAN_DEBUG=true` to log each thread’s `getMessages` raw count, how many have non-empty `text`, and why a row was skipped (same env works for iMessage **`recall all`**).

### Location pings → iMessage (queue + poll)

When the web app posts **`POST /api/location`** and the backend enqueues a message, deliver it with:

```bash
npm run agent:notify-poll
```

Uses `SECOND_BRAIN_API_URL`, `SECOND_BRAIN_USER_ID`, optional `NOTIFY_POLL_INTERVAL_MS` (default `30000`). The user must set **notification frequency** and **iMessage target** in Dashboard → Settings.

## 5. Trigger from iPhone or Mac Messages

In the **same chat** where you messaged the bot, send a message containing the trigger, e.g.:

- `recall` — full stub summary + optional ingest  
- `recall quick` — shorter TLDR (see `ai-stub.ts`)
- `recall all` — **optional** multi-chat scan: with `RECALL_SCAN_ALL_CHATS=true`, walks up to `RECALL_MAX_CHATS_SCAN` threads (recent-first), pulls `RECALL_MESSAGES_PER_CHAT_SCAN` messages per thread, and calls **`POST /api/message` once per thread** so Supabase gets **multiple rows** (different dominant categories per chat). Uses `RECALL_GROUP_NAME_CONTAINS` the same way as single-thread recall when set.

The agent loads history **for that conversation** (`chatId` from Photon), not unrelated global traffic.

## Troubleshooting

- **No messages / empty history** — Confirm `agent:test:imessage` works; check Full Disk Access.  
- **Ingest skipped** — Set `SECOND_BRAIN_API_URL` and `SECOND_BRAIN_USER_ID` in `packages/imessage-agent/.env`.  
- **Group chats** — Replies use **`chatId`** so messages go back to the correct thread.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run agent:test:imessage` | List chats + read recent messages (no long-running watch). |
| `npm run agent:test:send` | Send test (see `test/test-send.ts`). |
| `npm run agent:test:watch` | Watch incoming messages. |
| `npm run agent:start` | Production-style: watch + `recall` handler + ingest hook. |
| `npm run agent:dev` | Same as `start` with `tsx watch`. |
| `npm run agent:scan-all` | Multi-chat ingest once (CLI). |
| `npm run agent:notify-poll` | Poll API for location-queue iMessages + send via Photon. |

Upstream docs: [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit), [`llms.txt`](https://github.com/photon-hq/imessage-kit/blob/main/llms.txt).
