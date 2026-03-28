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

## 5. Trigger from iPhone or Mac Messages

In the **same chat** where you messaged the bot, send a message containing the trigger, e.g.:

- `recall` — full stub summary + optional ingest  
- `recall quick` — shorter TLDR (see `ai-stub.ts`)

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

Upstream docs: [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit), [`llms.txt`](https://github.com/photon-hq/imessage-kit/blob/main/llms.txt).
