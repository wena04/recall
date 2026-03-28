# Second Brain Recall

Hackathon monorepo: **web** (`web/`), **API** (`api/`), **iMessage agent** (`packages/imessage-agent/`).

**How to work in this repo**

1. Read **`docs/GOAL.md`** — product + architecture contract (North Star).  
2. Read **`docs/PROGRESS.md`** — what is built, gaps, next tasks (update it when you ship).

```bash
npm install
cp .env.example .env
npm run dev
```

Agent (macOS): `cp packages/imessage-agent/.env.example packages/imessage-agent/.env` then `npm run agent:start`.
