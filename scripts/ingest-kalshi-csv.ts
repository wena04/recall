/**
 * Kalshi executed-orders CSV → aggregate stats → MiniMax extractContent → knowledge_items.
 *
 *   USER_ID=<auth.users uuid> npm run ingest:kalshi
 *
 * Optional:
 *   KALSHI_CSV=./path/to/orders.csv   (default: data/fixtures/kalshi_orders.csv)
 *
 * Requires root `.env`: SUPABASE_URL, SUPABASE_SERVICE_KEY, MINIMAX_API_KEY (+ optional MINIMAX_*).
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import "../api/load-env.js";
import { extractContent } from "../api/services/llm.js";
import type { ExtractionResult } from "../api/services/extract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const USER_ID = process.env.USER_ID ?? process.env.VITE_DEV_USER_ID;
const csvPath = process.env.KALSHI_CSV
  ? resolve(process.cwd(), process.env.KALSHI_CSV)
  : join(repoRoot, "data/fixtures/kalshi_orders.csv");

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!USER_ID) {
  console.error("Set USER_ID or VITE_DEV_USER_ID (Supabase auth user id).");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Row = {};
    headers.forEach((h, j) => {
      row[h.trim()] = (cols[j] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function bucketTicker(ticker: string): "tennis" | "basketball" | "crypto" | "other" {
  const t = ticker.toUpperCase();
  if (t.includes("BTC") || t.startsWith("KXBT")) return "crypto";
  if (t.includes("ATP") || t.includes("WTA")) return "tennis";
  if (t.includes("NBA") || t.includes("NCAAM") || t.includes("NCAAMB"))
    return "basketball";
  return "other";
}

function aggregate(rows: Row[]) {
  const byBucket = {
    tennis: [] as Row[],
    basketball: [] as Row[],
    crypto: [] as Row[],
    other: [] as Row[],
  };
  for (const r of rows) {
    const t = r.ticker ?? "";
    byBucket[bucketTicker(t)].push(r);
  }

  function stats(subset: Row[]) {
    let contracts = 0;
    let takerFees = 0;
    let takerCost = 0;
    const tickers = new Map<string, number>();
    let buys = 0;
    let sells = 0;
    let minT = "";
    let maxT = "";
    for (const r of subset) {
      contracts += num(r.fill_count_fp);
      takerFees += num(r.taker_fees_dollars);
      takerCost += num(r.taker_fill_cost_dollars);
      const tk = r.ticker ?? "";
      tickers.set(tk, (tickers.get(tk) ?? 0) + 1);
      if (r.action?.toLowerCase() === "sell") sells++;
      else buys++;
      const ct = r.created_time ?? "";
      if (!minT || ct < minT) minT = ct;
      if (!maxT || ct > maxT) maxT = ct;
    }
    const topTickers = [...tickers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([k, v]) => `${k} (${v} fills)`);
    const topBySpend = [...subset]
      .map((r) => ({
        ticker: r.ticker,
        cost: num(r.taker_fill_cost_dollars),
        side: r.side,
        action: r.action,
        contracts: num(r.fill_count_fp),
        time: r.created_time,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12);
    return {
      orders: subset.length,
      contracts,
      takerFees,
      takerCost,
      buys,
      sells,
      minT,
      maxT,
      topTickers,
      topBySpend,
    };
  }

  return {
    tennis: stats(byBucket.tennis),
    basketball: stats(byBucket.basketball),
    crypto: stats(byBucket.crypto),
    other: stats(byBucket.other),
    totalOrders: rows.length,
  };
}

type Agg = ReturnType<typeof aggregate>;

function buildSportsPrompt(a: Agg): string {
  const t = a.tennis;
  const b = a.basketball;
  return `Kalshi prediction-market export: tennis + basketball EXECUTED orders only (already filled).

Overall file: ${a.totalOrders} executed rows.

## Tennis (ATP/WTA / challengers)
- Executed orders: ${t.orders}, contract volume (fill_count sum): ${t.contracts.toFixed(0)}
- Buy vs sell (row counts): ${t.buys} buys / ${t.sells} sells
- Taker fees total (USD): $${t.takerFees.toFixed(2)}, taker fill cost total: $${t.takerCost.toFixed(2)}
- Date span: ${t.minT} … ${t.maxT}
- Most active tickers: ${t.topTickers.join("; ")}
- Largest taker-cost fills: ${JSON.stringify(t.topBySpend)}

## Basketball (NBA / NCAA men's)
- Executed orders: ${b.orders}, contract volume: ${b.contracts.toFixed(0)}
- Buys/sells: ${b.buys} / ${b.sells}
- Taker fees: $${b.takerFees.toFixed(2)}, taker fill cost: $${b.takerCost.toFixed(2)}
- Date span: ${b.minT} … ${b.maxT}
- Most active tickers: ${b.topTickers.join("; ")}
- Largest taker-cost fills: ${JSON.stringify(b.topBySpend)}

Task: Turn this into a concise memory for the user's second brain. Category should be Sports. Summarize what markets/themes they traded (matchups, spreads, totals), time window, and whether activity was mostly directional YES buys, hedges, or round-trips. Do not invent specific game outcomes — only what the log implies. action_items can include follow-ups like tax export or position review if appropriate.`;
}

function buildCryptoPrompt(a: Agg): string {
  const c = a.crypto;
  return `Kalshi prediction-market export: short-horizon Bitcoin / crypto-adjacent contracts (KXBTC*, etc.), executed orders only.

- Executed orders: ${c.orders}, contract volume: ${c.contracts.toFixed(0)}
- Buys/sells: ${c.buys} / ${c.sells}
- Taker fees: $${c.takerFees.toFixed(2)}, taker fill cost: $${c.takerCost.toFixed(2)}
- Date span: ${c.minT} … ${c.maxT}
- Tickers: ${c.topTickers.join("; ")}
- Largest cost fills: ${JSON.stringify(c.topBySpend)}

Task: Summarize for personal recall. Prefer category Ideas (trading / risk / short-term crypto exposure) unless you see a clearer fit. Mention 15m / daily-style contracts if present. No invented price predictions.`;
}

function buildOtherPrompt(a: Agg): string {
  const o = a.other;
  return `Kalshi prediction-market export: markets that are NOT tennis, NOT basketball, NOT BTC short-term (politics, cross-category multivariate, other sports, etc.), executed orders only.

- Executed orders: ${o.orders}, contract volume: ${o.contracts.toFixed(0)}
- Buys/sells: ${o.buys} / ${o.sells}
- Taker fees: $${o.takerFees.toFixed(2)}, taker fill cost: $${o.takerCost.toFixed(2)}
- Date span: ${o.minT} … ${o.maxT}
- Tickers: ${o.topTickers.join("; ")}
- Largest cost fills: ${JSON.stringify(o.topBySpend)}

Task: Summarize themes (ticker prefixes hint at event types). Pick the best single category among Food | Events | Sports | Ideas | Medical — often Ideas or Events for politics/macros; Sports only if clearly another sport. Be factual from the log only.`;
}

async function insertRow(
  userId: string,
  extraction: ExtractionResult,
  originalSnippet: string,
  sourceType: string,
) {
  const { error } = await supabase.from("knowledge_items").insert({
    user_id: userId,
    original_content_url: originalSnippet.slice(0, 8000),
    summary: extraction.summary,
    category: extraction.category,
    location_city: extraction.location.city,
    location_name: extraction.location.specific_name,
    action_items: extraction.action_items,
    source_context: extraction.source_context,
    source_type: sourceType,
    persona: extraction.persona ?? null,
    recall_enrichment: extraction.recall_enrichment ?? null,
  });
  if (error) throw new Error(error.message);
}

async function runChunk(
  label: string,
  prompt: string,
  sourceType: string,
): Promise<void> {
  console.log(`\n→ MiniMax extract: ${label} …`);
  const extraction = await extractContent(prompt, {
    userPreamble:
      "Output valid JSON only for the Recall knowledge schema. This is a private trading log for one user.",
  });
  if (!extraction) {
    console.error(`  ✗ ${label}: extraction failed (see logs above)`);
    return;
  }
  await insertRow(
    USER_ID!,
    extraction,
    `[Kalshi CSV] ${label}\n\n${prompt.slice(0, 6000)}`,
    sourceType,
  );
  console.log(
    `  ✓ Inserted [${extraction.category}]: ${extraction.summary.slice(0, 70)}…`,
  );
}

async function main() {
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(raw);
  console.log(`Read ${rows.length} data rows from ${csvPath}`);

  const agg = aggregate(rows);
  console.log(
    `Buckets — tennis: ${agg.tennis.orders}, basketball: ${agg.basketball.orders}, crypto: ${agg.crypto.orders}, other: ${agg.other.orders}`,
  );

  const jobs: { label: string; prompt: string; skip: boolean }[] = [
    {
      label: "sports",
      prompt: buildSportsPrompt(agg),
      skip: agg.tennis.orders + agg.basketball.orders === 0,
    },
    {
      label: "crypto",
      prompt: buildCryptoPrompt(agg),
      skip: agg.crypto.orders === 0,
    },
    {
      label: "other_markets",
      prompt: buildOtherPrompt(agg),
      skip: agg.other.orders === 0,
    },
  ];

  for (const j of jobs) {
    if (j.skip) {
      console.log(`\n⊘ Skip ${j.label} (no rows in bucket)`);
      continue;
    }
    try {
      await runChunk(j.label, j.prompt, "text");
    } catch (e) {
      console.error(`  ✗ ${j.label}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log("\nDone.");
}

main();
