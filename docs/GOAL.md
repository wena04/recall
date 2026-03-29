# GOAL.md — North Star (Architectural Blueprint)

**Audience:** Human team + AI coding agents (TRAE, Cursor, Claude).

**Last updated:** 2026-03-29 (kept in sync with **`docs/PROGRESS.md`** after major milestones).

**Rule of Engagement:** This is the immutable product and architecture contract. AI agents must read this file before writing any code to understand the system context, the MVC boundaries, and the data schema.

**Canonical docs in this repo:** this file (**`docs/GOAL.md`**) and **`docs/PROGRESS.md`**. Do not add parallel architecture files without folding them here or into **PROGRESS**.

**Quick matrix**

| | |
|--|--|
| **Progress / shipped / commands** | [`PROGRESS.md`](./PROGRESS.md) |
| **Web (Vite)** | `web/` → build output `dist/` |
| **API (Express source)** | `server/api-backend/` |
| **Vercel serverless bundle** | `api/index.mjs` (run `npm run vercel:bundle-api` after `npm run build`; gitignored) |
| **iMessage agent (macOS)** | `packages/imessage-agent/` |
| **DB migrations** | `supabase/migrations/` |

Setup: root **`README.md`**. Env templates: **`.env.example`**, **`packages/imessage-agent/.env.example`**.

**Frontend vs backend:** **Frontend** (React, Vite, Tailwind) lives in **`web/`**. **Backend** source (Express, MiniMax, Supabase service client) lives in **`server/api-backend/`**. **Local dev** runs **`server/dev-api.ts`** (HTTP + WebSocket). **Vercel** uses a bundled **`api/index.mjs`** (esbuild from **`server/vercel-entry.ts`**) — see **`vercel.json`** and **`npm run vercel:bundle-api`**.

---

## 1. The Vision & Pitch

**Tagline:** "又解决选择困难症，又解决记忆困难症" (Solving decision paralysis and memory loss, simultaneously).

**The Wedge (The Problem):** We consume too much unstructured information. We drop Rednote (Xiaohongshu) cafe recommendations, TikTok event reels, and random thoughts into massive group chats. Months later, when it's time to actually plan a trip or execute a project, that context is lost.

**The Solution:** We are building an **Autonomous Background Brain & Reflection Engine**. It ingests chaotic digital fragments, auto-categorizes them into a beautiful "Bento Box" dashboard, analyzes behavioral habits, and *proactively* pings you via iMessage when you physically arrive near a place you previously saved.

---

## 2. Core Features (The Product Streamline)

### Feature 1: Omni-Channel Ingestion (The Funnel)
* **Action:** Users feed the brain via chat exports (WhatsApp/WeChat `.txt`), pasted links, or image uploads (screenshots of IG/Rednote).
* **Native Magic:** macOS users run the Photon iMessage SDK to watch specific group chats and ingest context in real-time.
* **Batch / testing:** Optional **`recall all`** (iMessage) or **`npm run agent:scan-all`** (CLI) walks multiple threads — one **`POST /api/message`** per chat for category variety across the DB.
* **Connect UI (optional):** **`POST /api/imessage/scan-trigger`** notifies a **locally connected** Photon agent over the API **WebSocket** to run a multi-chat scan; the web app polls **`GET /api/imessage/scan-status`** for progress (**`agent:start`** must be running with WS URL configured).

### Feature 2: AI Auto-Categorization (The Brain)
* **Action:** The backend sends raw text and screenshots to MiniMax (Anthropic-compatible **Messages** API for text; native **`chatcompletion_v2`** for vision).
* **Extraction:** MiniMax outputs structured JSON: location, summary, category (**Food | Events | Sports | Ideas | Medical**), **`persona`**, **`recall_enrichment`** (for chat-style ingests), validated with Zod before writes.
* **Embeddings (retrieval):** After a successful extract, the API **asynchronously** embeds the **`summary`** (MiniMax embedding API, 1536-dim) and stores it on **`knowledge_items.embedding`** for **pgvector** search (migration **`0006`**).
* **Model split (intent):** Use **strong structured / engineering models** for extraction (default **`MINIMAX_MODEL`** e.g. M2.7-class). Use **dialogue / persona models** for conversational retrieval (see Feature 5). Use **`MINIMAX_LOCATION_MODEL`** (optional) for short location-ping copy. Configure via env — see **`docs/PROGRESS.md`**.

### Feature 3: The Reflection Dashboard (The "Cute" UI)
* **Vibe:** React + Bento-style cards, pastel tags, memory list with category, locations, optional **persona** and **recall_enrichment** (keywords, texting style).
* **Analytics:** **Recharts** “Digital diet” chart — share of saved items by **category** (counts from DB; category was set at **ingest** time, not a new LLM call on page load).
* **Knowledge Board:** List/detail of extracted memories; link back to original snippet via **`original_content_url`** / **`source_context`**.
* **Mirror Personality:** Optional **Analyze me** flow — backend aggregates ingested memories, calls MiniMax for a structured profile (MBTI guess, traits, interests, tone), persists **`user_personality`**, streams **SSE** progress from **`POST /api/personality/compute`**. Used to enrich Mirror Memory prompts (see Feature 5).

### Feature 4: Proactive Location Pings (The Flex)
* **Action:** The web app (with user permission) periodically sends **coarse geolocation** to the backend. **Settings** stores **notification frequency** (**off | hourly | every_6h | daily | new_city_only**) and an **iMessage delivery target** (phone or Photon **`chatId`**).
* **Backend:** **`POST /api/location`** receives lat/lng → reverse-geocode to a **city/area** (OSM Nominatim) → match **`knowledge_items`** by **`location_city` / `location_name`** → rate-limit per frequency → optional MiniMax draft → enqueue **`notification_outbox`**.
* **Execution (iMessage as the “notification”):** The **Photon agent does not receive a cloud WebSocket** in this repo. A local process **`npm run agent:notify-poll`** polls **`GET /api/notifications/pending/:userId`**, **`send()`**s each body to the configured target, then **`POST /api/notifications/:id/ack`**. The user still gets a normal **iMessage** (and iOS banner/lock screen as usual).
* **Not yet in scope:** Per-building geofencing, sub-mile radius matching, or PostGIS on **`knowledge_items`** unless explicitly added and migrated.

### Feature 5: The "Mirror Memory" Chatbot (RAG + Persona)
* **Action:** Users query saved memories from the **Dashboard** widget (**`POST /api/query`**). **iMessage** (**`recall`** in a thread) uses the **same** Mirror Memory pipeline via the macOS agent (**`packages/imessage-agent/`** → **`ingest-api.ts`** / **`queryMirrorMemory`**).
* **Retrieval (RAG):** Prefer **semantic search**: embed the question, call Supabase RPC **`match_knowledge_items`** (**pgvector** cosine on **`knowledge_items.embedding`**). If that returns nothing, fall back to **FTS / ilike** on **`summary`**, then recent items. Injects **`recall_enrichment`** / **`user_personality.profile`** context when available.
* **Model:** **`MINIMAX_RAG_MODEL`** via the same Anthropic-compatible Messages path as other text calls — **separate from** ingest **`MINIMAX_MODEL`**.
* **Persona Injection:** Prompt asks the model to answer in the user’s voice using stored style snippets and optional **`user_personality`** fields — **not** fine-tuning weights on the database.

---

## 3. Technical Stack & MVC Architecture

### 3.1 Stack

| Layer | Choice |
|-------|--------|
| IDE / story | **TRAE** (`@Chat` for planning, `@Builder` for execution) |
| AI Engine | **MiniMax** — Anthropic-compatible **`/v1/messages`** (text, RAG, location copy); native **`/text/chatcompletion_v2`** (vision) |
| Native Interface | **Photon** iMessage Kit — **`packages/imessage-agent/`**, macOS |
| Frontend (View) | **React + Vite + Tailwind CSS** — **`web/`** (Recharts, Radix, **Supabase Auth UI** — Google OAuth on **`/login`**) |
| Backend (Controller) | **Node.js + Express** — **`server/api-backend/`** |
| Database (Model) | **Supabase (PostgreSQL)** — **`supabase/migrations/`** |

### 3.2 MVC Enforcement for AI Agents

* **`server/api-backend/internal/load-env.ts`** loads **repo-root** `.env` **before** modules read **`process.env`**. Import it **first** in **`internal/app.ts`**.
* Keep route handlers in **`server/api-backend/routes/`** thin. MiniMax, geocoding, location rules, and RAG live in **`server/api-backend/services/`**.
* Frontend never calls MiniMax directly; only **`/api/*`**.

### 3.3 Deployment (Vercel)

* **Frontend:** Vite build output → repo root **`dist/`** (see **`web/vite.config.ts`**).
* **API:** Bundled **`api/index.mjs`** (serverless); **`vercel.json`** rewrites **`/api/*`** → that function and **`/*`** → **`index.html`**. Build: **`npm run build:vercel`** (`vite` + **`npm run vercel:bundle-api`**).
* **Client env on Vercel:** **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** must be set so the browser build can talk to Supabase (anon key is public by design; **never** put **`SUPABASE_SERVICE_KEY`** in `VITE_*`).
* **`packages/imessage-agent/`** is **not** part of the Vercel deployment (see **`.vercelignore`**). Location **delivery** requires a **Mac** running **`agent:notify-poll`** (or equivalent) against your deployed API URL.
* **Secrets:** set in Vercel Project → Environment Variables. **Never commit secrets.**

### 3.4 Honest onboarding

Ideal UX is "connect everything in one click." **Build** either a **real** path (Photon, exports, **`ingest:local`**) or a **transparent** simulated story in the pitch — never silent fake enterprise integrations.

### 3.5 Auth & per-user data

* **Sign-in:** **Supabase Auth** with **Google** provider on the **`/login`** page. **Landing** redirects signed-in users to **`/dashboard`**.
* **Row-level security:** **`knowledge_items`** and **`users`** use RLS tied to **`auth.uid()`** for client access patterns; the **Express** API uses the **service-role** Supabase client and still accepts **`userId`** in JSON bodies — treat server-side verification as a **post-hackathon** hardening item (see **`docs/PROGRESS.md`**).
* **Data migration:** Optional script **`npm run data:reassign-user`** reassigns rows to a real **`auth.users`** account by email (service key) when moving off shared dev UUIDs.

---

## 4. The Data Contract (LLM JSON Schema)

During **ingestion**, MiniMax should return JSON matching this shape (see **`server/api-backend/services/extract.ts`** for the canonical Zod schema):

```json
{
  "summary": "Short 2-sentence summary of the chat/image.",
  "category": "Food | Events | Sports | Ideas | Medical",
  "location": {
    "city": "string or null",
    "specific_name": "string or null"
  },
  "action_items": [
    { "task": "string", "owner": "string" }
  ],
  "source_context": "The original text snippet or image description.",
  "persona": null,
  "recall_enrichment": null
}
```

For **chat / iMessage transcripts**, **`recall_enrichment`** may be an object with **`keywords`**, **`places`**, **`courses_or_projects`**, **`texting_style`**. **`persona`** may describe chat role and tone. Plain notes/links often use **`null`** for both.

---

## 5. Repository Layout (Monorepo)

```
second-brain-recall/
├── docs/
│   ├── GOAL.md          ← North Star (this file) + quick matrix at top
│   └── PROGRESS.md      ← living build state — update after milestones
├── data/                ← raw_posts/, local/ (see data/README.md)
├── scripts/             ← bulk ingest, parsers → scripts/ingest/
├── web/                 ← **frontend** (Vite root); build → ../dist
├── server/
│   ├── dev-api.ts       ← local API + WebSocket (not Vercel)
│   ├── vercel-entry.ts  ← import app for esbuild bundle
│   └── api-backend/     ← Express: internal/app.ts, routes/, services/, lib/
├── api/
│   └── index.mjs        ← generated serverless bundle (gitignored); source: vercel-entry + api-backend
├── packages/
│   └── imessage-agent/  ← Photon agent; scan-all, notify-poll, recall / recall all
├── supabase/migrations/
├── vercel.json
├── .env.example
└── package.json         ← workspaces: packages/*
```

**MVC mapping**

| Layer | Path |
|-------|------|
| View | `web/src/`, `web/public/` |
| Controller | `server/api-backend/routes/`, `server/api-backend/internal/app.ts` |
| Model | `supabase/migrations/`, `server/api-backend/lib/supabase.ts` |
| Services | `server/api-backend/services/` |
| Messaging | `packages/imessage-agent/` |

---

## 6. Execution Rules for AI Agents

1. Read **`docs/PROGRESS.md` first** — do not assume features exist until verified there.
2. **Before writing code:** read this file and **`docs/PROGRESS.md`** (live state, blockers, next task).
3. **After a merge-worthy milestone:** update **`docs/PROGRESS.md`** (done / in progress / blocked).
4. Keep route handlers thin; services own orchestration.
5. Prefer **structured LLM outputs** when extracting facts for storage.
6. **No secrets in Git** — env only; rotate leaked keys before public repo.
7. Prefer **small, shippable steps** over features that depend on non-existent consumer APIs.
8. **Reconcile migrations** before applying blindly — see **`docs/PROGRESS.md`** if duplicate version numbers or experimental SQL exist.

---

## 7. Future Extensions (from original GOAL.md)

These are validated ideas parked for post-MVP iteration:

* **"Catch me up"** — user returns to a noisy thread; agent summarizes what they missed + next steps, with source citations.
* **"Export and execute"** — structured output (tasks, decisions, owners) → Notion and/or copy-friendly formats.
* **Source citations** — `sources[]` array in extraction output linking back to original message excerpts.
* **True push from cloud → Mac** — WebSocket / APNs bridge (only if product needs instant server-initiated delivery without polling).

---

*End of GOAL.md*
