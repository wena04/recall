import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { User } from "@supabase/supabase-js";
import Settings from "@/components/Settings";
import BentoCard from "@/components/ui/BentoCard";
import SectionHeader from "@/components/ui/SectionHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import Chatbot from "@/components/Chatbot";
import LocationTracker from "@/components/LocationTracker";
import {
  PiBowlFood,
  PiCalendar,
  PiConfetti,
  PiGameController,
  PiHeartbeat,
  PiLightbulb,
  PiNewspaper,
  PiAirplaneTilt,
  PiBookOpen,
} from "react-icons/pi";

interface PersonaShape {
  chat_role?: string;
  tone?: string;
  bot_likelihood?: string;
  notes?: string;
}

interface RecallEnrichmentShape {
  keywords?: string[];
  places?: string[];
  courses_or_projects?: string[];
  texting_style?: string;
}

interface KnowledgeItem {
  id: string;
  original_content_url: string;
  summary: string;
  created_at: string;
  category?: "Food" | "Events" | "Sports" | "Ideas" | "Medical" | null;
  location_city?: string | null;
  location_name?: string | null;
  action_items?: { task: string; owner: string }[];
  source_context?: string | null;
  persona?: PersonaShape | Record<string, unknown> | null;
  recall_enrichment?: RecallEnrichmentShape | Record<string, unknown> | null;
  source_type?: string | null;
}

interface SectionItem {
  id: string;
  title: string;
  helper: string;
  icon: React.ElementType;
}

/** Matches MiniMax extraction categories + fallback for empty. */
const CATEGORY_CHART_COLORS: Record<string, string> = {
  Food: "#8b5cf6",
  Events: "#06b6d4",
  Sports: "#10b981",
  Ideas: "#f59e0b",
  Medical: "#ef4444",
  Uncategorized: "#a8a29e",
};

const SECTION_ITEMS: SectionItem[] = [
  {
    id: "food",
    title: "Food",
    helper: "Cafes, boba, and places to eat.",
    icon: PiBowlFood,
  },
  {
    id: "events",
    title: "Events",
    helper: "Concerts, meetups, and plans.",
    icon: PiConfetti,
  },
  {
    id: "sports",
    title: "Sports",
    helper: "Games, training, and activities.",
    icon: PiGameController,
  },
  {
    id: "ideas",
    title: "Ideas",
    helper: "Concepts, drafts, and inspiration.",
    icon: PiLightbulb,
  },
  {
    id: "medical",
    title: "Medical",
    helper: "Health notes and reminders.",
    icon: PiHeartbeat,
  },
  {
    id: "news",
    title: "News",
    helper: "Articles and timely updates.",
    icon: PiNewspaper,
  },
  {
    id: "travel",
    title: "Travel",
    helper: "Trips, cities, and destination notes.",
    icon: PiAirplaneTilt,
  },
  {
    id: "knowledge",
    title: "Knowledge",
    helper: "Learning snippets and references.",
    icon: PiBookOpen,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const bypass =
        import.meta.env.VITE_DEV_BYPASS_AUTH === "true" &&
        import.meta.env.VITE_DEV_USER_ID;
      if (bypass) {
        setUser({
          id: import.meta.env.VITE_DEV_USER_ID,
          email: "dev-bypass@local",
        } as User);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    };
    getSession();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      const response = await fetch(`/api/knowledge_items/${user.id}`);
      const { data } = await response.json();
      setKnowledgeItems(data || []);
      setLoading(false);
    };
    run();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  function isPersona(p: unknown): p is PersonaShape {
    return typeof p === "object" && p !== null && "chat_role" in p;
  }

  function isRecallEnrichment(r: unknown): r is RecallEnrichmentShape {
    return typeof r === "object" && r !== null;
  }

  const itemsByCategory = (cat: string) =>
    knowledgeItems.filter(
      (i) => (i.category ?? "").toLowerCase() === cat.toLowerCase(),
    );

  const categoryChartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const item of knowledgeItems) {
      const key = item.category?.trim() ? item.category : "Uncategorized";
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [knowledgeItems]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-12 sm:px-6 lg:px-8">
      {user && <LocationTracker userId={user.id} />}
      <div className="w-full max-w-6xl">
        <SectionHeader
          className="mb-8"
          title="Welcome"
          description={`Your memory feed is organized here${user?.email ? `, ${user.email.split("@")[0]}` : ""}. Add more sources anytime from Connect.`}
          action={
            <div className="flex items-center gap-3">
              <Settings user={user} />
              <button
                onClick={handleLogout}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
              >
                Logout
              </button>
            </div>
          }
        />

        <BentoCard className="mx-auto mb-8 max-w-5xl bg-gradient-to-r from-violet-50 to-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">Add memories</p>
              <p className="mt-0.5 text-xs text-stone-600">
                Choose a source: simulated iMessage, WeChat/WhatsApp export, or
                paste any thread.
              </p>
            </div>
            <Link
              to="/connect"
              className="inline-flex shrink-0 justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Open Connect
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="mx-auto max-w-5xl">
          <div className="mb-5 border-b border-violet-100/80 pb-4 text-center">
            <h2 className="text-lg font-semibold text-stone-900">
              Knowledge Sections
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Items from Connect and iMessage ingest are classified by MiniMax
              and listed below by category.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <StatusBadge tone="violet">8 Sections</StatusBadge>
              <StatusBadge tone={loading ? "stone" : "emerald"}>
                {loading
                  ? "Syncing items..."
                  : `${knowledgeItems.length} items ingested`}
              </StatusBadge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECTION_ITEMS.map((section) => {
              const count = itemsByCategory(section.title).length;
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  className="group flex min-h-56 flex-col justify-between rounded-2xl border border-violet-100 bg-violet-50/35 p-4 text-left transition-all hover:border-violet-200 hover:bg-violet-50/60"
                >
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 ring-1 ring-violet-100">
                        <Icon className="h-5 w-5 text-violet-600" />
                      </div>
                      <p className="text-base font-semibold text-stone-900">
                        {section.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      {section.helper}
                    </p>
                  </div>
                  <div className="mt-5">
                    <StatusBadge
                      tone={count > 0 ? "emerald" : "stone"}
                      className="normal-case tracking-normal transition-colors group-hover:border-violet-200/80 group-hover:bg-white/90"
                    >
                      {count > 0 ? `${count} saved` : "Empty"}
                    </StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCard>

        <BentoCard className="mx-auto mt-8 max-w-5xl">
          <div className="mb-4 border-b border-violet-100/80 pb-4">
            <h2 className="text-lg font-semibold text-stone-900">
              Digital diet
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Share of saved memories by category. Each slice counts rows in
              your database — labels were assigned by{" "}
              <strong className="font-medium text-stone-700">
                MiniMax at ingest time
              </strong>{" "}
              (Connect or Photon →{" "}
              <code className="rounded bg-stone-100 px-1 text-xs">
                POST /api/message
              </code>
              ), not by a new model call when you open this page.
            </p>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-stone-500">
              Loading chart…
            </p>
          ) : knowledgeItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">
              Ingest at least one memory to see the pie chart.
            </p>
          ) : (
            <div className="mx-auto flex max-w-md flex-col items-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={48}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {categoryChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_CHART_COLORS[entry.name] ?? "#78716c"}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} item${value === 1 ? "" : "s"}`,
                      "Count",
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        <BentoCard className="mx-auto mt-8 max-w-5xl">
          {user && <Chatbot userId={user.id} />}
        </BentoCard>

        <BentoCard className="mx-auto mt-8 max-w-5xl">
          <div className="mb-6 border-b border-violet-100/80 pb-4">
            <h2 className="text-lg font-semibold text-stone-900">
              Your memories
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Structured fields come from the same ingest pipeline: summary,
              category, location, persona, and recall enrichment.
            </p>
          </div>

          {loading ? (
            <p className="text-center text-sm text-stone-500">Loading…</p>
          ) : knowledgeItems.length === 0 ? (
            <p className="text-center text-sm text-stone-500">
              Nothing yet — use Connect to paste a thread or run the iMessage
              agent.
            </p>
          ) : (
            <ul className="space-y-4">
              {knowledgeItems.map((item) => {
                const persona =
                  item.persona && isPersona(item.persona) ? item.persona : null;
                const recall =
                  item.recall_enrichment &&
                  isRecallEnrichment(item.recall_enrichment)
                    ? item.recall_enrichment
                    : null;
                const keywords = recall?.keywords?.slice(0, 8) ?? [];
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-violet-100/90 bg-white/80 p-4 text-left shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900">
                          {item.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.category && (
                            <StatusBadge
                              tone="violet"
                              className="normal-case tracking-normal"
                            >
                              {item.category}
                            </StatusBadge>
                          )}
                          {item.source_type && (
                            <StatusBadge
                              tone="stone"
                              className="normal-case tracking-normal text-[11px]"
                            >
                              {item.source_type}
                            </StatusBadge>
                          )}
                          {(item.location_city || item.location_name) && (
                            <span className="text-xs text-stone-600">
                              📍{" "}
                              {[item.location_city, item.location_name]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <time
                        className="shrink-0 text-xs text-stone-400"
                        dateTime={item.created_at}
                      >
                        {new Date(item.created_at).toLocaleString()}
                      </time>
                    </div>

                    {persona && (
                      <div className="mt-3 rounded-xl bg-stone-50/90 px-3 py-2 text-xs text-stone-700">
                        <span className="font-medium text-stone-800">
                          Persona
                        </span>
                        <span className="text-stone-500">
                          {" "}
                          · {persona.chat_role}
                        </span>
                        {persona.tone && (
                          <span className="text-stone-500">
                            {" "}
                            · {persona.tone}
                          </span>
                        )}
                        {persona.notes && (
                          <p className="mt-1 leading-relaxed text-stone-600">
                            {persona.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {recall &&
                      (keywords.length > 0 ||
                        recall.texting_style ||
                        (recall.places?.length ?? 0) > 0) && (
                        <div className="mt-3 rounded-xl border border-violet-100/80 bg-violet-50/40 px-3 py-2 text-xs text-stone-700">
                          <p className="font-medium text-stone-800">
                            Recall enrichment
                          </p>
                          {keywords.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {keywords.map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-violet-800 ring-1 ring-violet-200/80"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                          {recall.texting_style && (
                            <p className="mt-2 leading-relaxed text-stone-600">
                              {recall.texting_style}
                            </p>
                          )}
                          {(recall.places?.length ?? 0) > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-stone-700">
                                Places
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {recall.places!.map((p) => (
                                  <span
                                    key={p}
                                    className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-violet-800 ring-1 ring-violet-200/80"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(recall.courses_or_projects?.length ?? 0) > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-stone-700">
                                Courses / Projects
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {recall.courses_or_projects!.map((c) => (
                                  <span
                                    key={c}
                                    className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-violet-800 ring-1 ring-violet-200/80"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {item.action_items && item.action_items.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-xs text-stone-600">
                        {item.action_items.map((a, idx) => (
                          <li key={idx}>
                            {a.task}
                            {a.owner ? ` — ${a.owner}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}

                    <details className="mt-2 text-xs text-stone-500">
                      <summary className="cursor-pointer select-none text-violet-700 hover:text-violet-900">
                        Original &amp; source context
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-stone-600">
                        {item.original_content_url}
                      </p>
                      {item.source_context && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-stone-600">
                          {item.source_context}
                        </p>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
