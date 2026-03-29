# PROGRESS.md — Current state (living document)

**Last updated:** 2026-03-28  
**Package name:** `second-brain-recall` (root `package.json`)

> Update this file after every merge-worthy milestone. **Accuracy over optimism.**

**Read first for coding:** this file. **Read for product contract:** `GOAL.md` (repo root quick matrix + **`docs/GOAL.md`** full blueprint).

**Where code lives:** **Frontend** → **`web/`** · **Backend** → **`api/`** (thin `routes/`, logic in `services/`).

---

## Alignment

**North Star:** `docs/GOAL.md` — **Autonomous Background Brain** (ingest → dashboard → location-tagged recommendations → iMessage via Photon poll → Mirror Memory chat).

**Primary paths:**

1. **Web `/login`** — **Supabase Auth** with **Google OAuth** (`@supabase/auth-ui-react`, redirect to `/dashboard`). Dev bypass still **`VITE_DEV_BYPASS_AUTH`** + **`VITE_DEV_USER_ID`** when enabled.
2. **Web `/connect`** — paste / samples / `.txt` → **`POST /api/message`** → MiniMax → **`knowledge_items`** (+ optional Notion) + async **`embedKnowledgeItem`** for **pgvector** search.
3. **Photon** — **`recall`** (per thread) or **`recall all`** (multi-chat, gated by env) → same **`POST /api/message`** with **`chat_label`** / **`ingest_note`**. **Connect UI** can **`POST /api/imessage/scan-trigger`** when the local agent is connected via **WebSocket** (`services/location.ts`); poll **`GET /api/imessage/scan-status`**.
4. **Dashboard** — **`GET /api/knowledge_items/:userId`**, **Digital diet** (Recharts), **Mirror Personality** (`PersonalityCard` → **`GET /api/personality/:userId`**, **`POST /api/personality/compute`** SSE), **Mirror Memory** → **`POST /api/query`**; optional **`useLocationReporter`** → **`POST /api/location`** when notifications not **off**.
5. **Mac + Photon** — **`npm run agent:notify-poll`** polls **`GET /api/notifications/pending/:userId`**, sends iMessage, **`POST .../ack`**.

**Product language:** inference + storage for retrieval in prompts — **not** fine-tuning MiniMax on the database.

---

## Done (verified in repo)

### Web — `web/`

- [x] Vite + React + TypeScript + Tailwind; build → repo **`dist/`**
- [x] Routes: Landing (Three.js hero + sections), **Login** (Google-only Auth UI), **`/connect`**, Dashboard
- [x] Landing / Login: session check → redirect authenticated users to **`/dashboard`**
- [x] Supabase Auth; dev bypass **`VITE_DEV_BYPASS_AUTH`** + **`VITE_DEV_USER_ID`**
- [x] Ingest via **`POST /api/message`**; list via **`GET /api/knowledge_items/:userId`**
- [x] **Settings** (Radix): Notion + **notification frequency** + **`notification_imessage_to`** (Photon **`send`** target); **`users`** upsert on save
- [x] **Digital diet** — Recharts pie/donut by **`category`** from loaded items
- [x] **Memory cards** — summary, category, locations, persona, recall_enrichment, action items, expandable original/context
- [x] **Mirror Personality** — **`PersonalityCard.tsx`**: fetch profile, **Analyze me** streams SSE from **`/api/personality/compute`**
- [x] **Mirror Memory Chatbot** (`Chatbot.tsx`) → **`POST /api/query`** (semantic + keyword fallback; see API)
- [x] **`useLocationReporter`** — ~5 min interval **`POST /api/location`** when frequency ≠ **off** (browser Geolocation; localhost or HTTPS)

### API — `api/`

- [x] **`api/load-env.ts`** — loads **repo-root** `.env` **first** in **`app.ts`**
- [x] **`POST /api/message`** — MiniMax (`llm.ts`) + Zod **`extract.ts`** → **`knowledge_items`**; optional Notion; **`embedKnowledgeItem`** (non-blocking) after successful extract
- [x] Vision path: **`extractContentFromImage`** (`image_base64` + `mime_type`) — no image upload in `/connect` UI
- [x] **`GET /api/knowledge_items/:userId`** · **`GET /api/health`**
- [x] **`POST /api/query`** — **`services/rag.ts`**: **MiniMax embeddings** → **`match_knowledge_items`** (pgvector); fallback **FTS / ilike** on **`summary`**; injects **`user_personality.profile`** into prompt; **`MINIMAX_RAG_MODEL`** via **`callMiniMaxTextCompletion`**
- [x] **`GET /api/personality/:userId`** · **`POST /api/personality/compute`** (SSE progress + final JSON profile)
- [x] **`POST /api/imessage/scan-trigger`** · **`GET /api/imessage/scan-status`** — orchestrate **scan-all** when agent WebSocket connected
- [x] **`POST /api/location`** — **`services/location_ping.ts`**: Nominatim reverse geocode, match memories by city/name, rate limits, optional **`MINIMAX_LOCATION_MODEL`** copy → **`notification_outbox`**
- [x] **`GET /api/notifications/pending/:userId`** · **`POST /api/notifications/:id/ack`**
- [x] **`routes/auth.ts`** — Express stubs (**`/api/auth/*`** unused); real auth is **Supabase client** on web

### Data — Supabase

- [x] **`0000`**–**`0001`** — **`users`**, **`knowledge_items`** + enriched columns; **RLS** on **`users`** and **`knowledge_items`** (own rows)
- [x] **`0002`** — **`persona` JSONB**
- [x] **`0003`** — **`recall_enrichment` JSONB**
- [x] **`0004_notification_location_outbox.sql`** — user location prefs + **`notification_outbox`**
- [x] ⚠️ **Also in repo:** **`0004_add_notification_frequency_to_users.sql`** (narrow ALTER) and **`0005_add_location_notifications.sql`** (PostGIS **`location::geography`** on **`knowledge_items`** — **not** wired in app code; **may fail** if `location` / PostGIS absent). **Before `supabase db push`:** merge or drop conflicting files; **`location_ping`** uses **string** city matching only.
- [x] **`0006_embeddings_personality.sql`** — **`vector`** extension, **`knowledge_items.embedding`** (1536), HNSW index, **`match_knowledge_items`** RPC, **`user_personality`** + RLS

### iMessage — `packages/imessage-agent/`

- [x] Watch + **`recall`** / **`recall quick`**; ingest → **`ingestTranscriptToSecondBrain`**
- [x] **`recall all`** when **`RECALL_SCAN_ALL_CHATS=true`** — **`scan-all-chats.ts`**
- [x] **`npm run agent:scan-all`** — CLI multi-chat ingest (**`run-scan-all.ts`**); **`RECALL_SCAN_DEBUG`**
- [x] **`npm run agent:notify-poll`** — **`run-notify-poll.ts`** delivers **`notification_outbox`** via Photon
- [x] Agent can subscribe to API **WebSocket** for **`scan_all`** (driven from **`/api/imessage/scan-trigger`**)
- [x] README: Full Disk Access, scan-all, notify-poll, env tables

### Tooling / demo data

- [x] **`demo/sample_data.json`** — 21 rows, all five categories + optional persona/enrichment; **`data/fixtures/diverse_knowledge_items.json`** copy
- [x] **`demo:load`** — optional **`FIXTURE_FILE=...`**
- [x] **`ingest:local`**, **`ingest:parse-cn`**, **`ingest:seed`**, **`ingest:kalshi`**, **`dev:ensure-user`**, **`dev:smoke-api`**
- [x] **`data:reassign-user`** → **`scripts/reassign-all-data-to-user.ts`** — service-role migration of **`knowledge_items`** / **`notification_outbox`** to a target **`auth.users`** email (for moving off dev UUID)

---

## Gaps vs GOAL.md

| Gap | Notes |
|-----|--------|
| **Photon chat RAG** | Mirror Memory is **Dashboard**-first; iMessage-native Q&A not wired. |
| **Vision UI** | **`/connect`** screenshot path is caption/text only; Vision via API body fields. |
| **Building-level / radius pings** | City + string match on **`location_*`** only; no lat/lng per memory in app logic. |
| **Migration hygiene** | Duplicate **`0004_*`** and experimental **`0005`** (PostGIS) need team decision before clean **`db push`**. **`0006`** requires **pgvector** enabled (migration runs **`CREATE EXTENSION vector`**). |
| **Embedding / RPC edge cases** | Ingest and RAG use service client + JSON embedding payloads; confirm **`match_knowledge_items`** behaves with your Supabase/PostgREST version after **`db push`**. |
| **`/api/auth/*`** | Stubs only; **no** server JWT verification on **`POST /api/*`** — trust **`userId`** in body (hackathon / dev model). |
| **Notion** | Token + DB ID stored; full two-way sync not product-complete. |
| **Infinite loop (notify ↔ agent)** | Prefix / dedupe hardening still worth a pass (see root **`GOAL.md`**). |

---

## Suggested next tasks (priority)

1. **Consolidate Supabase migrations** — single **`0004`** story + resolve **`0005`** vs **`0006`** ordering if `db push` fails.
2. **Secure APIs** — verify **`userId`** against Supabase session or signed token for **`/api/location`**, **`/api/query`**, **`/api/notifications/*`**, **`/api/personality/*`**.
3. **Photon** — optional **`getMessages({ since })`**; pipe **`recall`** questions to **`/api/query`**.
4. **Demo polish** — video, honest fixture vs live ingest story.

---

## API contract (current)

### `GET /api/knowledge_items/:userId`

Returns **`{ status: 'success', data: KnowledgeItem[] }`**. Shape includes **`persona`**, **`recall_enrichment`**, **`embedding`** may be present.

### `POST /api/message`

Unchanged from prior contract: **`userId`**, **`type`**, **`content`**, optional **`source_type`**, **`chat_label`**, **`ingest_note`**, **`image_base64`**, **`mime_type`**.

### `POST /api/query`

```typescript
{ userId: string; question: string }
// → { answer: string }
```

Uses **vector similarity** when **`match_knowledge_items`** + embeddings succeed; else FTS / ilike / recent items.

### `GET /api/personality/:userId`

```typescript
// → { profile: object | null, computed_at: string | null }
```

### `POST /api/personality/compute`

```typescript
{ userId: string }
// SSE: { type: 'progress' | 'done' | 'error', ... }
```

### `POST /api/imessage/scan-trigger`

```typescript
{ userId: string }
// → { ok: true, status: 'scanning' } or 503 if agent offline
```

### `GET /api/imessage/scan-status?userId=`

Returns in-memory scan state for that user (idle | scanning | done | error + progress).

### `POST /api/location`

```typescript
{ userId: string; lat: number; lng: number }
// → { ok, skipped?, city?, matchingMemories?, queued?, outboxId? }
```

### `GET /api/notifications/pending/:userId`

```typescript
{ deliverTo: string | null; notifications: Array<{ id: string; body: string; created_at: string }> }
```

### `POST /api/notifications/:id/ack`

```typescript
{ userId: string } // body
// → { ok: true }
```

---

## Model env (reference)

| Variable | Role |
|----------|------|
| **`MINIMAX_MODEL`** | Ingest extraction (Anthropic Messages) — default **MiniMax-M2.7** |
| **`MINIMAX_RAG_MODEL`** | **`/api/query`** — default **M2.7-class** id in **`rag.ts`** |
| **`MINIMAX_LOCATION_MODEL`** | Location ping body — defaults to **`MINIMAX_MODEL`** |
| **`MINIMAX_LEGACY_MODEL`** | Vision native **`chatcompletion_v2`** |
| Embeddings | **`callMiniMaxEmbedding`** in **`llm.ts`** (1536-dim, used for ingest + query + personality batching) |

See **`.env.example`** and [Anthropic-compatible MiniMax docs](https://platform.minimax.io/docs/api-reference/text-anthropic-api).

---

## Environment variables

**Root `.env`:** MiniMax, Supabase server + Vite, **`PORT`**, dev bypass. **Google OAuth** enabled in **Supabase Dashboard** (provider) + **Site URL / redirect URLs** for your app origin.

**Agent `packages/imessage-agent/.env`:** **`SECOND_BRAIN_*`**, **`RECALL_*`**, **`NOTIFY_POLL_INTERVAL_MS`**, **`RECALL_SCAN_ALL_CHATS`**, **`RECALL_SCAN_DEBUG`**, etc.

**Vercel:** mirror root vars; **`agent:notify-poll`** on Mac should point **`SECOND_BRAIN_API_URL`** at deployed API if applicable.

---

## Commands

```bash
npm install
cp .env.example .env
npm run dev

USER_ID=<uuid> npm run demo:load
FIXTURE_FILE=./data/fixtures/diverse_knowledge_items.json USER_ID=<uuid> npm run demo:load

# macOS — Photon
npm run agent:start
npm run agent:scan-all
npm run agent:notify-poll
```

Also: **`npm run build`**, **`npm run check`**, **`npm run lint`**, **`npm run ingest:local`**, **`npm run data:reassign-user`** (needs **`SUPABASE_SERVICE_KEY`**, **`TARGET_EMAIL`**).

---

## Decisions / blockers

| Topic | Status | Notes |
|-------|--------|--------|
| MiniMax | Text/RAG via **`api.minimax.io/anthropic`** + **`x-api-key`**; vision via legacy host | Token Plan **`sk-cp-*`** vs **`sk-api-*`** per account docs |
| **`imessage_id` on `users`** | Open | Column exists; not wired to notify target |
| Product name | Open | Align deck |

---

## Changelog

- **2026-03-28** — Google OAuth Login; **`0006`** pgvector + **`user_personality`**; **`rag.ts`** semantic search + personality in prompt; **`personality`** routes + **`PersonalityCard`** SSE; **`imessage`** scan-trigger/status + agent WS; ingest **`embedKnowledgeItem`**; **`reassign-all-data-to-user`** script; refreshed gaps (migrations, API auth).
