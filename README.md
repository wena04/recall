# Recall

**Your second brain for chat** — ingest conversations, structure them with AI, and ask what matters with natural language (including **`recall`** in iMessage on macOS).

**Built for:** [USC BIA Trae × MiniMax Hackathon 2026](https://devpost.com/software/recall-xt2rg5) — hackathon submission on Devpost.

---

## Links

| | |
|--|--|
| **Live app** | [traerecall1ehv.vercel.app](https://traerecall1ehv.vercel.app) |
| **Devpost** | [Recall — Devpost](https://devpost.com/software/recall-xt2rg5) |

---

## Authors

- **David Gao**
- **Anthony Wen**

---

## What it does

- **Web dashboard** — Sign in with Google, paste or import chat-style text from **WeChat, WhatsApp, iMessage (Photon), and other sources**, and save structured memories.
- **Mirror Memory** — RAG over your saved items (semantic search + MiniMax answers in your context).
- **Mirror Personality** — Optional “Analyze me” profile from ingested memories.
- **Categories & analytics** — Auto-categorized memories (e.g. Food, Events, Sports, Ideas, Medical) and a “digital diet” view.
- **iMessage agent (macOS)** — Local Photon agent: say **`recall`** in a thread for Mirror Memory; optional **`recall all`** / scan-all ingest; optional **location-based** nudges via iMessage when the notify poller is running.
- **Settings** — Notification frequency, iMessage delivery target, optional Notion connection.

---

## Tech stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS  
- **Backend:** Node.js, Express (serverless bundle on Vercel)  
- **Auth & data:** Supabase (Auth, PostgreSQL, **pgvector** for embeddings)  
- **AI:** MiniMax (extraction, embeddings, RAG / Mirror Memory, optional vision path)  
- **iMessage:** [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit) (macOS agent)  
- **Deploy:** Vercel (app + API)  
- **Other:** Google OAuth, TRAE (development workflow per team)

---

## Development

For architecture, env vars, and local setup (API + web + optional iMessage agent):

```bash
npm install
cp .env.example .env
npm run dev
```

See **`docs/GOAL.md`** and **`docs/PROGRESS.md`** for full detail.
