import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import BentoCard from "./ui/BentoCard";

interface PersonalityProfile {
  mbti_guess: string;
  mbti_confidence: "low" | "medium" | "high";
  personality_summary: string;
  communication_traits: string[];
  top_interests: string[];
  language_style: string;
  social_style: string;
  emotional_tone: string;
  computed_at: string;
  based_on_items: number;
}

function mbtiColor(type: string): string {
  const letter = type?.[1]?.toUpperCase(); // N or S
  const last = type?.[3]?.toUpperCase();   // J or P
  if (letter === "N" && last === "F") return "bg-violet-100 text-violet-800 ring-violet-300";
  if (letter === "N" && last === "T") return "bg-blue-100 text-blue-800 ring-blue-300";
  if (letter === "S" && last === "F") return "bg-emerald-100 text-emerald-800 ring-emerald-300";
  return "bg-amber-100 text-amber-800 ring-amber-300";
}

function confidenceColor(c: string) {
  if (c === "high") return "text-emerald-600";
  if (c === "medium") return "text-amber-500";
  return "text-stone-400";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PersonalityCard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PersonalityProfile | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiFetch(`/api/personality/${userId}`);
        const d = await r.json();
        if (!cancelled) {
          setProfile(d.profile ?? null);
          setComputedAt(d.computed_at ?? null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [progressLog, setProgressLog] = useState<string[]>([]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    setProgressLog([]);

    try {
      const res = await apiFetch("/api/personality/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: "progress" | "done" | "error";
              message?: string;
              profile?: PersonalityProfile;
            };
            if (event.type === "progress" && event.message) {
              setProgressLog((prev) => [...prev, event.message!]);
            } else if (event.type === "done" && event.profile) {
              setProfile(event.profile);
              setComputedAt(event.profile.computed_at);
              setProgressLog([]);
            } else if (event.type === "error") {
              setError(event.message ?? "Unknown error");
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <BentoCard className="mx-auto mt-8 max-w-5xl">
      <div className="mb-4 flex items-start justify-between border-b border-violet-100/80 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Mirror Personality</h2>
          <p className="mt-1 text-sm text-stone-500">
            Inferred from your texting style, keywords, and saved memories.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {analyzing ? "Analyzing…" : profile ? "Reanalyze" : "Analyze me"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Live progress log */}
      {analyzing && progressLog.length > 0 && (
        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
          <ul className="space-y-1.5">
            {progressLog.map((msg, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-violet-800">
                <span className="mt-0.5 shrink-0 text-violet-400">▸</span>
                <span>{msg}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-xs text-violet-500">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
            </li>
          </ul>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-stone-400">Loading…</p>
      ) : !profile ? (
        <div className="py-8 text-center">
          <p className="text-sm text-stone-500">
            No personality profile yet. Click <strong>Analyze me</strong> to build one from your memories.
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Works best after ingesting iMessage chats with recall enrichment.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* MBTI badge + summary */}
          <div className="flex items-start gap-4">
            <div className={`shrink-0 rounded-2xl px-4 py-3 text-center ring-1 ${mbtiColor(profile.mbti_guess)}`}>
              <p className="text-2xl font-bold tracking-wider">{profile.mbti_guess}</p>
              <p className={`mt-0.5 text-[11px] font-medium ${confidenceColor(profile.mbti_confidence)}`}>
                {profile.mbti_confidence} confidence
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-stone-700">{profile.personality_summary}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                <span>🎭 {profile.social_style}</span>
                <span>·</span>
                <span>💬 {profile.language_style}</span>
                <span>·</span>
                <span>✨ {profile.emotional_tone}</span>
              </div>
            </div>
          </div>

          {/* Communication traits */}
          {profile.communication_traits.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                Communication style
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.communication_traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-800 ring-1 ring-violet-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top interests */}
          {profile.top_interests.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                Top interests
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.top_interests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-[11px] text-stone-400">
            Based on {profile.based_on_items} memories
            {computedAt ? ` · analyzed ${relativeTime(computedAt)}` : ""}
          </p>
        </div>
      )}
    </BentoCard>
  );
}
