# GOAL.md — North Star (Architectural Blueprint)

**Audience:** Human team + AI coding agents (TRAE, Cursor, Claude).

**Rule of Engagement:** This is the immutable product and architecture contract. AI agents must read this file before writing any code to understand the system context, the MVC boundaries, and the data schema.

**Canonical docs in this repo:** only **`GOAL.md`** (this file) and **`PROGRESS.md`**. Do not add parallel architecture files without folding them here or into **PROGRESS**.

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

### Feature 2: AI Auto-Categorization (The Brain)
* **Action:** The backend sends raw text and screenshots to the MiniMax Text/Vision APIs.
* **Extraction:** MiniMax is strictly prompted to extract the location, summarize the vibe, and assign a category tag (🍔 Food/Boba, 🎫 Events, ⚽ Sports, 💡 Ideas, 🏥 Medical).

### Feature 3: The Reflection Dashboard (The "Cute" UI)
* **Vibe:** A React-based, highly visual "Bento Box" UI (rounded corners, pastel tags, masonry grid).
* **Analytics:** Recharts/Chart.js visualizes the user's "Digital Diet" (e.g., "45% of your saved items this month are Food-related").
* **Knowledge Board:** A filterable grid of all extracted memories, linking back to the original chat source.

### Feature 4: Proactive Location Pings (The Flex)
* **Action:** The web app tracks location. The user sets a "Notification Frequency" in the UI (e.g., "Ping me once a day" or "Ping me when I'm within 5 miles").
* **Execution:** When the user arrives in a new city, the Node backend triggers the Photon agent to send a native iMessage: *"📍 Welcome! Based on your saved reels from last month, here are 3 spots you wanted to check out..."*

### Feature 5: The "Mirror Memory" Chatbot (RAG + Persona)
* **Action:** Users can query their saved database using natural language either through a React chat widget on the dashboard or natively via the Photon iMessage agent.
* **Retrieval (RAG):** The backend searches Supabase for relevant memories based on the user's question (e.g., "What LA cafes did we save?").
* **Persona Injection:** The MiniMax prompt is dynamically injected with the user's "Tone Profile." The AI does not answer like a generic assistant; it acts as the user's digital clone, delivering the retrieved memories using the user's exact slang, humor, and personal context.

---

## 3. Technical Stack & MVC Architecture

### 3.1 Stack

| Layer | Choice |
|-------|--------|
| IDE / story | **TRAE** (`@Chat` for planning, `@Builder` for execution) |
| AI Engine | **MiniMax** (Text API for extraction/summarization, Vision API for screenshots) |
| Native Interface | **Photon** iMessage Kit — **`packages/imessage-agent/`**, macOS |
| Frontend (View) | **React + Vite + Tailwind CSS** — **`web/`** (Bento Box styling, Recharts) |
| Backend (Controller) | **Node.js + Express** — **`api/`** (orchestrates MiniMax calls and Photon webhooks) |
| Database (Model) | **Supabase (PostgreSQL)** — schema in **`supabase/migrations/`** |

### 3.2 MVC Enforcement for AI Agents

* Keep route handlers in `api/routes/` thin. All MiniMax and Photon logic must live in **`api/services/`**.
* Frontend components must remain purely presentational, fetching data from the Express backend, never calling MiniMax directly.
* Add domain logic in **`api/services/`** first; routes validate and delegate.

### 3.3 Deployment (Vercel)

* **Frontend:** Vite build output → repo root **`dist/`** (see **`web/vite.config.ts`**).
* **API:** **`api/index.ts`** as serverless handler; **`vercel.json`** rewrites **`/api/*`** → that function and **`/*`** → **`index.html`**.
* **`packages/imessage-agent/`** is **not** part of the Vercel deployment (see **`.vercelignore`**).
* **Secrets:** set in Vercel Project → Environment Variables. **Never commit secrets.**

### 3.4 Demo Integrity

Ideal UX is "connect everything in one click." **Build** either a **real** path (Photon, exports, optional local ingest) or a **transparent** simulated onboarding — never silent fake enterprise integrations. Staged fixtures are OK if **disclosed** in UI and pitch.

---

## 4. The Data Contract (LLM JSON Schema)

To ensure the AI doesn't break the database, **MiniMax must output strictly in this JSON format** during the ingestion phase:

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
  "source_context": "The original text snippet or image description."
}
```

---

## 5. Repository Layout (Monorepo)

```
second-brain-recall/
├── docs/
│   ├── GOAL.md          ← this file (North Star)
│   └── PROGRESS.md      ← living build state — update after milestones
├── data/                ← samples, `raw_posts/` (CN paste .txt), parser output in `output/` (gitignored); `data/local/` = private exports (see data/README.md)
├── demo/                ← `sample_data.json` + `demo:load` script
├── scripts/             ← bulk ingest, etc.; parsers for downloaded files → `scripts/ingest/`
├── web/                 ← **frontend** (Vite root); build → ../dist
├── api/                 ← **backend** — Express; server.ts (local), index.ts (Vercel)
├── packages/
│   └── imessage-agent/  ← Photon agent; npm workspace: imessage-agent
├── supabase/migrations/
├── vercel.json
├── .env.example         ← API-oriented vars; agent has its own .env.example
└── package.json         ← workspaces: packages/*
```

**`.vercel/`** — local link to Vercel project (CLI); optional to commit for team alignment.

**`.trae/`** — **gitignored** TRAE Solo scratch; do not treat as source of truth.

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

1. Read **`docs/PROGRESS.md` first** — do not assume MiniMax, RAG, or `chat.db` exist until checked there.
2. **Before writing code:** read this file and **`docs/PROGRESS.md`** (live state, blockers, next task).
3. **After a merge-worthy milestone:** update **`docs/PROGRESS.md`** (done / in progress / blocked).
4. Keep route handlers thin; services own orchestration.
5. Prefer **structured LLM outputs** when extracting facts for storage.
6. **No secrets in Git** — env only; rotate leaked keys before public repo.
7. Prefer **small, shippable steps** over features that depend on non-existent consumer APIs.

---

## 7. Future Extensions (from original GOAL.md)

These are validated ideas parked for post-MVP iteration:

* **"Catch me up"** — user returns to a noisy thread; agent summarizes what they missed + next steps, with source citations.
* **"Export and execute"** — structured output (tasks, decisions, owners) → Notion and/or copy-friendly formats.
* **Source citations** — `sources[]` array in extraction output linking back to original message excerpts.

---

*End of GOAL.md*
