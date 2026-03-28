import { supabase } from "../lib/supabase.js";
import { callMiniMaxTextCompletion } from "./llm.js";
import { reverseGeocodeCity } from "./geocode.js";

/** Use M2-her so notifications feel like they come from the user's own digital twin. */
const LOCATION_MODEL = process.env.MINIMAX_LOCATION_MODEL || "M2-her";
/** M2-her max_tokens cap is 2048. */
const LOCATION_MAX_TOKENS = 2048;

function minMsBetweenNotifications(f: string): number | null {
  switch (f) {
    case "off":
      return null;
    case "hourly":
      return 60 * 60 * 1000;
    case "every_6h":
      return 6 * 60 * 60 * 1000;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "new_city_only":
      return 4 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function normalizeCity(c: string): string {
  return c.trim().toLowerCase();
}

function cityMatchesRow(cityNorm: string, row: { location_city?: string | null; location_name?: string | null }): boolean {
  const lc = (row.location_city ?? "").toLowerCase();
  const ln = (row.location_name ?? "").toLowerCase();
  return (
    (lc.length > 0 && (lc.includes(cityNorm) || cityNorm.includes(lc))) ||
    (ln.length > 0 && (ln.includes(cityNorm) || cityNorm.includes(ln)))
  );
}

export interface LocationReportResult {
  ok: boolean;
  skipped?: string;
  city?: string | null;
  matchingMemories?: number;
  queued?: boolean;
  outboxId?: string;
}

export async function processLocationReport(
  userId: string,
  lat: number,
  lng: number,
): Promise<LocationReportResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, skipped: "invalid_coords" };
  }

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select(
      "notification_frequency, notification_imessage_to, last_location_city, last_location_notification_at",
    )
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return { ok: false, skipped: "user_not_found" };
  }

  const frequency = (user.notification_frequency || "off") as string;
  const previousCityNorm = user.last_location_city
    ? normalizeCity(user.last_location_city)
    : "";

  if (frequency === "off") {
    await supabase
      .from("users")
      .update({ last_location_lat: lat, last_location_lng: lng })
      .eq("id", userId);
    return { ok: true, skipped: "notifications_off" };
  }

  if (!user.notification_imessage_to?.trim()) {
    await supabase
      .from("users")
      .update({ last_location_lat: lat, last_location_lng: lng })
      .eq("id", userId);
    return { ok: true, skipped: "no_imessage_target_set" };
  }

  const city = await reverseGeocodeCity(lat, lng);
  if (!city) {
    await supabase
      .from("users")
      .update({ last_location_lat: lat, last_location_lng: lng })
      .eq("id", userId);
    return { ok: true, skipped: "geocode_failed", city: null };
  }

  const cityNorm = normalizeCity(city);

  const { data: rows, error: itemsErr } = await supabase
    .from("knowledge_items")
    .select("id, summary, category, location_city, location_name")
    .eq("user_id", userId)
    .limit(150);

  if (itemsErr) {
    console.error("location_ping items:", itemsErr);
    await supabase
      .from("users")
      .update({
        last_location_lat: lat,
        last_location_lng: lng,
        last_location_city: city,
      })
      .eq("id", userId);
    return { ok: false, skipped: "db_error", city };
  }

  const matches = (rows ?? []).filter((r) => cityMatchesRow(cityNorm, r));

  if (matches.length === 0) {
    await supabase
      .from("users")
      .update({
        last_location_lat: lat,
        last_location_lng: lng,
        last_location_city: city,
      })
      .eq("id", userId);
    return { ok: true, skipped: "no_memories_in_city", city, matchingMemories: 0 };
  }

  const now = Date.now();
  const lastAt = user.last_location_notification_at
    ? new Date(user.last_location_notification_at).getTime()
    : 0;
  const minGap = minMsBetweenNotifications(frequency);

  if (frequency === "new_city_only") {
    if (previousCityNorm && cityNorm === previousCityNorm) {
      await supabase
        .from("users")
        .update({
          last_location_lat: lat,
          last_location_lng: lng,
          last_location_city: city,
        })
        .eq("id", userId);
      return { ok: true, skipped: "same_city", city, matchingMemories: matches.length };
    }
  }

  if (minGap !== null && lastAt > 0 && now - lastAt < minGap) {
    await supabase
      .from("users")
      .update({
        last_location_lat: lat,
        last_location_lng: lng,
        last_location_city: city,
      })
      .eq("id", userId);
    return {
      ok: true,
      skipped: "rate_limited",
      city,
      matchingMemories: matches.length,
    };
  }

  const bullets = matches
    .slice(0, 8)
    .map(
      (m) =>
        `- [${m.category ?? "?"}] ${m.summary?.slice(0, 120) ?? ""}${(m.summary?.length ?? 0) > 120 ? "…" : ""}`,
    )
    .join("\n");

  const system = `You are the user's Mirror Memory — their digital twin sending a self-reminder iMessage.
Write as if YOU are the user texting yourself. Casual, personal, first-person ("hey, remember when..." / "omg we should...").
Max ~500 characters. No markdown. Emoji ok. Be specific from the memory list; never invent venues.`;

  const userPrompt = `You just arrived near: ${city}

Your saved memories about this area:
${bullets}

Write one short iMessage to yourself reminding you what to check out or remember here.`;

  let body: string;
  try {
    body = await callMiniMaxTextCompletion(userPrompt, system, LOCATION_MODEL, LOCATION_MAX_TOKENS);
    body = body.trim().slice(0, 1000);
  } catch (e) {
    console.error("location_ping llm:", e);
    body = `hey, you're near ${city}! you have ${matches.length} saved memories here — check your Recall dashboard 📍`;
  }

  const { data: row, error: insErr } = await supabase
    .from("notification_outbox")
    .insert({
      user_id: userId,
      body,
      context: {
        city,
        item_count: matches.length,
        item_ids: matches.map((m) => m.id),
      },
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("location_ping outbox:", insErr);
    await supabase
      .from("users")
      .update({
        last_location_lat: lat,
        last_location_lng: lng,
        last_location_city: city,
      })
      .eq("id", userId);
    return { ok: false, skipped: "outbox_insert_failed", city };
  }

  await supabase
    .from("users")
    .update({
      last_location_lat: lat,
      last_location_lng: lng,
      last_location_city: city,
      last_location_notification_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return {
    ok: true,
    city,
    matchingMemories: matches.length,
    queued: true,
    outboxId: row?.id,
  };
}
