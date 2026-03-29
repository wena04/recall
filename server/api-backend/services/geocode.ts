/**
 * Reverse geocode for coarse "what city are you in" — matches knowledge_items.location_city.
 * Uses OSM Nominatim; be polite: low frequency from the client (see Dashboard interval).
 */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=json`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RecallSecondBrain/1.0 (local-dev; +https://github.com/)",
    },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    address?: Record<string, string>;
  };
  const a = j.address;
  if (!a) return null;
  const city =
    a.city || a.town || a.village || a.municipality || a.county || a.state;
  return typeof city === "string" && city.trim() ? city.trim() : null;
}
