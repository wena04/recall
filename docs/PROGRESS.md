# PROGRESS.md — Current state (living document)

**Last updated:** 2026-03-29  
**Package name:** `second-brain-recall` (root `package.json`)

> Update this file after every merge-worthy milestone. **Accuracy over optimism.**

**Read first for coding:** this file. **Read for product contract:** `GOAL.md`.

**Where code lives:** **Frontend** → **`web/`** · **Backend** → **`api/`** (split client/server; MVC-style layering inside `api/` — thin `routes/`, logic in `services/`).

---

## Alignment

**North Star:** `docs/GOAL.md` — **Autonomous Background Brain** (omni-channel ingest → Bento dashboard → optional pings + Mirror Memory).

**Current code path:**

1. **Web:** **`/connect`** — paste / `.txt` / simulated samples → **`POST /api/message`** → MiniMax → **`knowledge_items`** (+ optional Notion).
2. **Photon (macOS):** **`packages/imessage-agent`** — watch iMessage → trigger word (`recall`) → **`getMessages`** scoped by **`chatId`** → same **`POST /api/message`** with **`chat_label`** + **`ingest_note`** → MiniMax structured JSON (**`persona`**, **`recall_enrichment`**) → reply in-thread with summary when ingest succeeds.

**Product language:** ingestion stores **structured memory** for retrieval / future prompts (RAG-style). It is **not** fine-tuning MiniMax weights on the database.

---

## Done (verified in repo)

### Web — `web/`

- [x] Vite + React + TypeScript + Tailwind (`vite.config.ts` sets `root` to `web/`, build output to repo `dist/`)
- [x] Routes: Landing, Login, **`/connect`** (source picker + multiline ingest), Dashboard
- [x] Supabase Auth (client); dev bypass via **`VITE_DEV_BYPASS_AUTH`** + **`VITE_DEV_USER_ID`**
- [x] Ingest: `POST /api/message` with `content` + `source_type`; optional **`image_base64`** + **`mime_type`** (Vision — **API/scripts only**, no image upload in `/connect` UI); list via **`GET /api/knowledge_items/:userId`**
- [x] Settings (Radix): Notion token + database ID on `users`

### API — `api/`

- [x] `app.ts` mounts routes; `server.ts` local dev (`PORT` default **3001**); **`index.ts`** Vercel serverless entry — types use **`express`** `Request`/`Response` (no **`@vercel/node`** package)
- [x] **`POST /api/message`** — insert → **MiniMax** (`api/services/llm.ts`) → Zod **`extract.ts`** → update **`knowledge_items`** (`summary`, `category`, locations, `action_items`, `source_context`, **`persona`**, **`recall_enrichment`**) → optional Notion
- [x] Optional body fields: **`chat_label`**, **`ingest_note`** (Photon / demo context for the model)
- [x] Vision path: **`extractContentFromImage`** when `image_base64` + `mime_type` present
- [x] `GET /api/knowledge_items/:userId` · `GET /api/health`
- [x] `routes/auth.ts` — stubs only (TODO)

### Data — Supabase

- [x] Migrations **`0000`**–**`0001`** — core **`users`**, **`knowledge_items`** + enriched columns
- [x] **`0002_knowledge_items_persona.sql`** — **`persona` JSONB**
- [x] **`0003_recall_enrichment.sql`** — **`recall_enrichment` JSONB** (apply on remote; Cursor **Supabase MCP** **`user-supabase`** used to run SQL on project **`kryrqcqpcxvevmbfuxiu`**)

### iMessage — `packages/imessage-agent/`

- [x] **`@photon-ai/imessage-kit`** — watch DM/group; **`getMessages({ chatId, limit, excludeOwnMessages: false, excludeReactions: true })`**; **`send`** via **`chatId`** (groups) or sender
- [x] **`SECOND_BRAIN_*`** → **`ingestTranscriptToSecondBrain`** → **`POST /api/message`** with **`chat_label`** + **`ingest_note`**; response drives **`formatRecallImessageReply`** (MiniMax summary in iMessage when ingest OK)
- [x] Env: **`RECALL_GROUP_NAME_CONTAINS`** (optional group-only filter), **`RECALL_DEMO_HINT`**, **`MAX_MESSAGES`** (default **400** in `.env.example`), **`CHAT_LABEL_REFRESH_MS`**, chat label cache from **`listChats`**
- [x] **`packages/imessage-agent/README.md`** — setup, Full Disk Access (**Cursor.app**), troubleshooting **`chat.db`**
- [x] **`agent:test:imessage`** — improved errors + **`formatChatLabel`** in test output
- [x] Tests: **`npm run agent:test:imessage`**, `agent:test:send`, `agent:test:watch`, **`npm run agent:start`**

### Tooling / quality

- [x] Removed unused deps: **`openai`**, **`zustand`**, **`lucide-react`**; removed **`@vercel/node`** (audit clean after reinstall)
- [x] ESLint ignores `packages/imessage-agent/**`
- [x] `.vercelignore` excludes `packages/imessage-agent`
- [x] Docs: **`GOAL.md`** + **`PROGRESS.md`** (+ **`data/README.md`** for data layout)

### Scripts / data pipeline (see `data/README.md`)

- [x] **`npm run ingest:local`**, **`ingest:parse-cn`**, **`ingest:seed`**, **`dev:ensure-user`**, **`dev:smoke-api`**, **`demo:load`**

---

## Gaps vs GOAL.md

| Gap | Notes |
|-----|--------|
| **Citations / RAG** | No chunk store or grounded Q&A over **`knowledge_items`** yet; stored rows are **retrieval-ready** for later Mirror Memory. |
| **Vision UI** | **`/connect`** screenshot card is **text/caption** only; Vision via **API** (`image_base64` + `mime_type`). |
| **Dashboard** | Lists items; **no** `recall_enrichment` / persona rich display yet; Bento / charts in **Suggested next tasks**. |
| **Tone / “digital twin” profile** | **`texting_style`** in **`recall_enrichment`**; no dedicated **`users.tone_profile`** or MBTI field yet (pitch = inference + storage, not clinical typing). |
| **Photon** | **macOS + Full Disk Access**; not deployable on Vercel (local agent). |
| **Auth API** | `/api/auth/*` unused; session is Supabase client-side. |
| **Secrets** | Rotate if **`.env`** ever committed; use **`.env.example`** as template only. |

---

## Suggested next tasks (priority)

1. **Dashboard** — show **`category`**, **`location_*`**, **`persona`**, **`recall_enrichment`** (keywords, courses, texting line) on cards.
2. **Photon** — optional **`RECALL_SINCE_DAYS`** + **`getMessages({ since })`** for “recent thread only.”
3. **Mirror / Decision Maker** — one **`POST /api/query`** (or similar) that retrieves top **`knowledge_items`** + injects **`recall_enrichment.texting_style`** into MiniMax (RAG prototype).
4. **Demo video** — TRAE + MiniMax + (optional) Photon on Mac; honest data story.
5. **`users` profile** — optional JSONB **`tone_profile`** (MBTI-inspired sketch, editable) aggregated from ingests.

---

## Team Split (Hackathon) — status snapshot

Historical checklist; many items are **done** in repo (MiniMax, Zod, migrations, `/connect`, agent → API).

| Area | Status |
|------|--------|
| DB + extraction + **`POST /api/message`** | Done — see **Done** above |
| Dashboard polish (Bento, charts, enrichment UI) | Open |
| Mirror Memory widget | Stretch |

---

## API Contract (current)

### `GET /api/knowledge_items/:userId` — item shape

```typescript
interface KnowledgeItem {
  id: string;
  user_id?: string;
  original_content_url: string;
  summary: string;
  category: string | null;
  location_city: string | null;
  location_name: string | null;
  action_items: { task: string; owner: string }[];
  source_context: string | null;
  source_type: string | null;
  persona: Record<string, unknown> | null;       // JSONB — optional
  recall_enrichment: Record<string, unknown> | null; // JSONB — optional
  notion_page_id: string | null;
  created_at: string;
}
```

### `POST /api/message` — request body

```typescript
interface MessageRequest {
  userId: string;
  type: string;
  content: string;
  source_type?: 'text' | 'url' | 'chat_export' | 'image' | 'rednote' | 'tiktok';
  chat_label?: string;      // e.g. group display name (Photon)
  ingest_note?: string;     // extra context for MiniMax (demo hints)
  image_base64?: string;    // Vision
  mime_type?: string;       // image/png, image/jpeg, …
}
```

---

## Environment variables

**Root** — see **`.env.example`**: **MiniMax**, **Supabase** (`SUPABASE_*`, `VITE_SUPABASE_*`), optional **`PORT`**, dev bypass.

**Agent** — **`packages/imessage-agent/.env`**: **`RECALL_TRIGGER`**, **`MAX_MESSAGES`**, **`RECALL_GROUP_NAME_CONTAINS`**, **`RECALL_DEMO_HINT`**, **`SECOND_BRAIN_API_URL`**, **`SECOND_BRAIN_USER_ID`**, **`SECOND_BRAIN_INGEST_ON_RECALL`**.

**Vercel:** mirror root env vars for the deployed API + static site.

---

## Commands

```bash
npm install
cp .env.example .env
npm run dev                   # Vite :5173 + Express :3001

# macOS — Photon (see packages/imessage-agent/README.md)
cp packages/imessage-agent/.env.example packages/imessage-agent/.env
npm run agent:test:imessage
npm run agent:start
```

Other: **`npm run build`**, **`npm run check`**, **`npm run lint`**, **`npm run ingest:local`**, **`npm run demo:load`**.

---

## Decisions / blockers

| Topic | Status | Notes |
|-------|--------|--------|
| MiniMax model name | `MiniMax-Text-01` in `llm.ts` | Can swap if account supports other text models |
| Link `imessage_id` to users | Open | Column exists |
| Product name | Open | Align pitch deck |

---

## Changelog

- **2026-03-29** — **PROGRESS sweep for GitHub push:** consolidated **Done** (Photon ↔ API, **`recall_enrichment`**, **`chat_label`/`ingest_note`**, migrations, MCP note, removed stale **`chat.db` / team-task** contradictions); refreshed **gaps**, **API contract**, **next tasks**; clarified **retrieval vs training** in alignment.
- **2026-03-28** — **Recall pipeline:** MiniMax **`recall_enrichment`**; **`POST /api/message`** **`chat_label`**, **`ingest_note`**; Photon **group filter**, **`RECALL_DEMO_HINT`**; migration **`0003`**. 
- **2026-03-28** — **Deps:** removed **`@vercel/node`**, **`openai`**, **`zustand`**, **`lucide-react`**; **`api/index.ts`** uses Express types.
- **2026-03-28** — **Photon agent:** **`chatId`**-scoped **`getMessages`**; **`packages/imessage-agent/README.md`**; Full Disk Access notes (**Cursor.app**).
- **2026-03-28** — **Docs:** frontend **`web/`** / backend **`api/`** naming in **GOAL** + **PROGRESS**.
- **2026-03-28** — **Vision + persona (API):** `image_base64` + `mime_type`; **`persona`** column **`0002`**.
- **2026-03-28** — **`/connect`**, **`data/README.md`**, **`ingest:local`**, **`ingest:seed`**, CN parser, rednote/tiktok cards.
