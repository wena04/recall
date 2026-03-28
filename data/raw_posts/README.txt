Put manually copied 小红书 (or similar) posts here — ONE post per .txt file.

Naming
  demo-la-cafe.txt
  demo-seattle-brunch.txt
  (any name is fine; only *.txt are parsed)

Workflow
  1. Save your copies as .txt in this folder (or use ../local/raw_posts/ for private copies — not committed).
  2. npm run ingest:parse-cn
     → writes ../output/seed_posts.json (gitignored)
  3. Populate database — pick one:
     npm run ingest:seed -- --mode db    (fast, uses parser fields; no MiniMax)
     npm run ingest:seed -- --mode api   (needs npm run dev; MiniMax re-extracts each)

Optional: put companion map screenshots in assets/ next to this folder
  data/raw_posts/assets/   (e.g. Google Maps markup — for Vision / deck later; not read by the .txt parser)

Public repo: scrub real phone numbers, home addresses, and other PII before commit.
