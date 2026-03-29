# GOAL.md — North Star (Architectural Blueprint)

**Audience:** Human team + AI coding agents (TRAE, Cursor, Claude).

**Last updated:** 2026-03-28 (kept in sync with **`docs/PROGRESS.md`** after major milestones).

**Rule of Engagement:** This is the immutable product and architecture contract. AI agents must read this file before writing any code to understand the system context, the MVC boundaries, and the data schema.

**Canonical docs in this repo:** **`docs/GOAL.md`** (this file), **`docs/PROGRESS.md`**, and the short feature matrix at repo root **`GOAL.md`**. Do not add parallel architecture files without folding them here or into **PROGRESS**.

**Frontend vs backend folders:** **Frontend** (React, Vite, Tailwind) lives in **`web/`**. **Backend** (Express, MiniMax orchestration, Supabase server client) lives in **`api/`**. Two separate top-level directories — no need to rename them to `frontend/` and `backend/`.

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
* **Action:** Users query saved memories from the **Dashboard** widget (**`POST /api/query`**) and (stretch) natively via Photon.
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
| Backend (Controller) | **Node.js + Express** — **`api/`** |
| Database (Model) | **Supabase (PostgreSQL)** — **`supabase/migrations/`** |

### 3.2 MVC Enforcement for AI Agents

* **`api/load-env.ts`** must load **repo-root** `.env` **before** any module that reads **`process.env`** (e.g. **`lib/supabase.ts`**). Import it **first** in **`app.ts`**.
* Keep route handlers in **`api/routes/`** thin. MiniMax, geocoding, location rules, and RAG live in **`api/services/`**.
* Frontend never calls MiniMax directly; only **`/api/*`**.

### 3.3 Deployment (Vercel)

* **Frontend:** Vite build output → repo root **`dist/`** (see **`web/vite.config.ts`**).
* **API:** **`api/index.ts`** as serverless handler; **`vercel.json`** rewrites **`/api/*`** → that function and **`/*`** → **`index.html`**.
* **`packages/imessage-agent/`** is **not** part of the Vercel deployment (see **`.vercelignore`**). Location **delivery** requires a **Mac** running **`agent:notify-poll`** (or equivalent) against your deployed API URL.
* **Secrets:** set in Vercel Project → Environment Variables. **Never commit secrets.**

### 3.4 Demo Integrity

Ideal UX is "connect everything in one click." **Build** either a **real** path (Photon, exports, optional local ingest) or a **transparent** simulated onboarding — never silent fake enterprise integrations. Staged fixtures are OK if **disclosed** in UI and pitch (**`demo:load`**, **`demo/sample_data.json`**).

### 3.5 Auth & per-user data

* **Sign-in:** **Supabase Auth** with **Google** provider on the **`/login`** page. **Landing** redirects signed-in users to **`/dashboard`**.
* **Row-level security:** **`knowledge_items`** and **`users`** use RLS tied to **`auth.uid()`** for client access patterns; the **Express** API uses the **service-role** Supabase client and still accepts **`userId`** in JSON bodies — treat server-side verification as a **post-hackathon** hardening item (see **`docs/PROGRESS.md`**).
* **Data migration:** Optional script **`npm run data:reassign-user`** reassigns rows to a real **`auth.users`** account by email (service key) when moving off shared dev UUIDs.

---

## 4. The Data Contract (LLM JSON Schema)

During **ingestion**, MiniMax should return JSON matching this shape (see **`api/services/extract.ts`** for the canonical Zod schema):

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
├── GOAL.md              ← short feature matrix (links here + PROGRESS)
├── docs/
│   ├── GOAL.md          ← this file (North Star)
│   └── PROGRESS.md      ← living build state — update after milestones
├── data/                ← samples, fixtures, raw_posts/ … (see data/README.md)
├── demo/                ← sample_data.json + demo:load (+ optional FIXTURE_FILE)
├── scripts/             ← bulk ingest, parsers → scripts/ingest/
├── web/                 ← **frontend** (Vite root); build → ../dist
├── api/                 ← **backend** — load-env.ts, app.ts, routes/, services/
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
| Controller | `api/routes/`, `api/app.ts` |
| Model | `supabase/migrations/`, `api/lib/supabase.ts` |
| Services | `api/services/` |
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
