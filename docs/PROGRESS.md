# PROGRESS.md — Current state (living document)

**Last updated:** 2026-03-28  
**Package name:** `second-brain-recall` (root `package.json`)

> Update this file after every merge-worthy milestone. **Accuracy over optimism.**

**Read first for coding:** this file. **Read for product contract:** `GOAL.md`.

**Where code lives:** **Frontend** → **`web/`** · **Backend** → **`api/`** (thin `routes/`, logic in `services/`).

---

## Alignment

**North Star:** `docs/GOAL.md` — **Autonomous Background Brain** (ingest → dashboard → location-tagged recommendations → iMessage via Photon poll → Mirror Memory chat).

**Primary paths:**

1. **Web `/connect`** — paste / samples / `.txt` → **`POST /api/message`** → MiniMax → **`knowledge_items`** (+ optional Notion).
2. **Photon** — **`recall`** (per thread) or **`recall all`** (multi-chat, gated by env) → same **`POST /api/message`** with **`chat_label`** / **`ingest_note`** → iMessage reply when ingest succeeds.
3. **Dashboard** — **`GET /api/knowledge_items/:userId`**, **Digital diet** (Recharts), **Mirror Memory** → **`POST /api/query`**; optional **`useLocationReporter`** → **`POST /api/location`** when notifications not **off**.
4. **Mac + Photon** — **`npm run agent:notify-poll`** polls **`GET /api/notifications/pending/:userId`**, sends iMessage, **`POST .../ack`**.

**Product language:** inference + storage for retrieval in prompts — **not** fine-tuning MiniMax on the database.

---

## Done (verified in repo)

### Web — `web/`

- [x] Vite + React + TypeScript + Tailwind; build → repo **`dist/`**
- [x] Routes: Landing, Login, **`/connect`**, Dashboard
- [x] Supabase Auth; dev bypass **`VITE_DEV_BYPASS_AUTH`** + **`VITE_DEV_USER_ID`**
- [x] Ingest via **`POST /api/message`**; list via **`GET /api/knowledge_items/:userId`**
- [x] **Settings** (Radix): Notion + **notification frequency** + **`notification_imessage_to`** (Photon **`send`** target); **`users`** upsert on save
- [x] **Digital diet** — Recharts pie/donut by **`category`** from loaded items
- [x] **Memory cards** — summary, category, locations, persona, recall_enrichment, action items, expandable original/context
- [x] **Mirror Memory Chatbot** (`Chatbot.tsx`) → **`POST /api/query`**
- [x] **`useLocationReporter`** — ~5 min interval **`POST /api/location`** when frequency ≠ **off** (browser Geolocation; localhost or HTTPS)

### API — `api/`

- [x] **`api/load-env.ts`** — loads **repo-root** `.env` **first** in **`app.ts`** (fixes import order vs **`lib/supabase.ts`**)
- [x] **`POST /api/message`** — MiniMax (`llm.ts`) + Zod **`extract.ts`** → **`knowledge_items`**; optional Notion
- [x] Vision path: **`extractContentFromImage`** (`image_base64` + `mime_type`) — no image upload in `/connect` UI
- [x] **`GET /api/knowledge_items/:userId`** · **`GET /api/health`**
- [x] **`POST /api/query`** — **`services/rag.ts`**: retrieval + **`MINIMAX_RAG_MODEL`** (default **M2-her**-style id) via **`callMiniMaxTextCompletion`**
- [x] **`POST /api/location`** — **`services/location_ping.ts`**: Nominatim reverse geocode, match memories by city/name, rate limits, optional **`MINIMAX_LOCATION_MODEL`** copy → **`notification_outbox`**
- [x] **`GET /api/notifications/pending/:userId`** · **`POST /api/notifications/:id/ack`**
- [x] **`routes/auth.ts`** — stubs (unused)

### Data — Supabase

- [x] **`0000`**–**`0001`** — **`users`**, **`knowledge_items`** + enriched columns
- [x] **`0002`** — **`persona` JSONB**
- [x] **`0003`** — **`recall_enrichment` JSONB**
- [x] **`0004_notification_location_outbox.sql`** — user location prefs + **`notification_outbox`**
- [x] ⚠️ **Also in repo:** **`0004_add_notification_frequency_to_users.sql`** (narrow ALTER) and **`0005_add_location_notifications.sql`** (PostGIS **`location::geography`** on **`knowledge_items`** — **not** wired in app code; **may fail** if `location` / PostGIS absent). **Before `supabase db push`:** merge or drop conflicting files; **`location_ping`** uses **string** city matching only.

### iMessage — `packages/imessage-agent/`

- [x] Watch + **`recall`** / **`recall quick`**; ingest → **`ingestTranscriptToSecondBrain`**
- [x] **`recall all`** when **`RECALL_SCAN_ALL_CHATS=true`** — **`scan-all-chats.ts`**
- [x] **`npm run agent:scan-all`** — CLI multi-chat ingest (**`run-scan-all.ts`**); **`RECALL_SCAN_DEBUG`**
- [x] **`npm run agent:notify-poll`** — **`run-notify-poll.ts`** delivers **`notification_outbox`** via Photon
- [x] README: Full Disk Access, scan-all, notify-poll, env tables

### Tooling / demo data

- [x] **`demo/sample_data.json`** — 21 rows, all five categories + optional persona/enrichment; **`data/fixtures/diverse_knowledge_items.json`** copy
- [x] **`demo:load`** — optional **`FIXTURE_FILE=...`**
- [x] **`ingest:local`**, **`ingest:parse-cn`**, **`ingest:seed`**, **`dev:ensure-user`**, **`dev:smoke-api`**

---

## Gaps vs GOAL.md

| Gap | Notes |
|-----|--------|
| **Photon chat RAG** | Mirror Memory is **Dashboard**-first; iMessage-native Q&A not wired. |
| **Vision UI** | **`/connect`** screenshot path is caption/text only; Vision via API body fields. |
| **Building-level / radius pings** | City + string match on **`location_*`** only; no lat/lng per memory in app logic. |
| **Migration hygiene** | Duplicate **`0004_*`** and experimental **`0005`** (PostGIS) need team decision before clean **`db push`**. |
| **RAG quality** | **`textSearch`** on **`summary`** may need DB extension / tuning; failures fall back to empty context. |
| **`users.tone_profile`** | Not a dedicated column; style lives in **`recall_enrichment`** snippets. |
| **Auth API** | `/api/auth/*` unused; **`POST /api/*`** not JWT-guarded — hackathon trust model. |

---

## Suggested next tasks (priority)

1. **Consolidate Supabase migrations** — single **`0004`** for notifications + remove or fix **`0005`** vs schema.
2. **Secure APIs** — verify **`userId`** against Supabase session or signed token for **`/api/location`**, **`/api/query`**, **`/api/notifications/*`**.
3. **RAG** — pg_trgm / embedding search; handle **`textSearch`** errors gracefully in UI.
4. **Photon** — optional **`getMessages({ since })`**; pipe **`recall`** questions to **`/api/query`**.
5. **Demo polish** — video, honest fixture vs live ingest story.

---

## API contract (current)

### `GET /api/knowledge_items/:userId`

Returns **`{ status: 'success', data: KnowledgeItem[] }`**. Shape includes **`persona`**, **`recall_enrichment`** JSONB when present.

### `POST /api/message`

Unchanged from prior contract: **`userId`**, **`type`**, **`content`**, optional **`source_type`**, **`chat_label`**, **`ingest_note`**, **`image_base64`**, **`mime_type`**.

### `POST /api/query`

```typescript
{ userId: string; question: string }
// → { answer: string }
```

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
| **`MINIMAX_RAG_MODEL`** | **`/api/query`** — default **M2-her** |
| **`MINIMAX_LOCATION_MODEL`** | Location ping body — defaults to **`MINIMAX_MODEL`** |
| **`MINIMAX_LEGACY_MODEL`** | Vision native **`chatcompletion_v2`** |

See **`.env.example`** and [Anthropic-compatible MiniMax docs](https://platform.minimax.io/docs/api-reference/text-anthropic-api).

---

## Environment variables

**Root `.env`:** MiniMax, Supabase server + Vite, **`PORT`**, dev bypass.

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

Also: **`npm run build`**, **`npm run check`**, **`npm run lint`**, **`npm run ingest:local`**.

---

## Decisions / blockers

| Topic | Status | Notes |
|-------|--------|--------|
| MiniMax | Text/RAG via **`api.minimax.io/anthropic`** + **`x-api-key`**; vision via legacy host | Token Plan **`sk-cp-*`** vs **`sk-api-*`** per account docs |
| **`imessage_id` on `users`** | Open | Column exists; not wired to notify target |
| Product name | Open | Align deck |

---

## Changelog

- **2026-03-28** — **`GOAL.md`** / **`PROGRESS.md`** aligned with repo: **`api/load-env`**, Dashboard **Digital diet** + **Mirror Memory** → **`POST /api/query`**, **`POST /api/location`** + **`notification_outbox`** + **`agent:notify-poll`**, **`recall all`** / **`agent:scan-all`** + **`RECALL_SCAN_DEBUG`**, diverse **`demo:load`** fixtures, multi-model env table; noted duplicate **`0004_*`** migrations and experimental **`0005`** (PostGIS) vs app behavior.
