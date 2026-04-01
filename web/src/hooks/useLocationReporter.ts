import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const INTERVAL_MS = 5 * 60 * 1000;

/**
 * When notification_frequency !== off, periodically POST coarse location to /api/location (browser Geolocation).
 * Requires https (or localhost). Respect user OS permission.
 */
export function useLocationReporter(userId: string | undefined) {
  const [frequency, setFrequency] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const refreshFrequency = async () => {
      const { data } = await supabase
        .from("users")
        .select("notification_frequency")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled && data?.notification_frequency !== undefined) {
        setFrequency(data.notification_frequency ?? "off");
      }
    };

    void refreshFrequency();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || frequency === null || frequency === "off") return;

    const report = () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void apiFetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 120_000, timeout: 20_000 },
      );
    };

    report();
    const interval = setInterval(() => {
      void supabase
        .from("users")
        .select("notification_frequency")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.notification_frequency !== undefined) {
            setFrequency(data.notification_frequency ?? "off");
          }
        });
      report();
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId, frequency]);
}
