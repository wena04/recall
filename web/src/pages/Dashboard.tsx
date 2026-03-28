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
import StatusBadge from "@/components/ui/StatusBadge";
import Chatbot from "@/components/Chatbot";
import LocationTracker from "@/components/LocationTracker";
import MemoryCard, { type KnowledgeItem } from "@/components/MemoryCard";
import MemoryEditModal from "@/components/MemoryEditModal";
import PersonalityCard from "@/components/PersonalityCard";
import {
  PiBowlFood,
  PiConfetti,
  PiGameController,
  PiHeartbeat,
  PiLightbulb,
  PiNewspaper,
  PiAirplaneTilt,
  PiBookOpen,
} from "react-icons/pi";

interface SectionItem {
  id: string;
  title: string;
  helper: string;
  icon: React.ElementType;
}

const CATEGORY_CHART_COLORS: Record<string, string> = {
  Food: "#8b5cf6",
  Events: "#06b6d4",
  Sports: "#10b981",
  Ideas: "#f59e0b",
  Medical: "#ef4444",
  News: "#3b82f6",
  Travel: "#f97316",
  Knowledge: "#84cc16",
  Uncategorized: "#a8a29e",
};

const SECTION_ITEMS: SectionItem[] = [
  { id: "food", title: "Food", helper: "Cafes, boba, and places to eat.", icon: PiBowlFood },
  { id: "events", title: "Events", helper: "Concerts, meetups, and plans.", icon: PiConfetti },
  { id: "sports", title: "Sports", helper: "Games, training, and activities.", icon: PiGameController },
  { id: "ideas", title: "Ideas", helper: "Concepts, drafts, and inspiration.", icon: PiLightbulb },
  { id: "medical", title: "Medical", helper: "Health notes and reminders.", icon: PiHeartbeat },
  { id: "news", title: "News", helper: "Articles and timely updates.", icon: PiNewspaper },
  { id: "travel", title: "Travel", helper: "Trips, cities, and destination notes.", icon: PiAirplaneTilt },
  { id: "knowledge", title: "Knowledge", helper: "Learning snippets and references.", icon: PiBookOpen },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week" | "month" | "year">("all");

  useEffect(() => {
    const getSession = async () => {
      const bypass =
        import.meta.env.VITE_DEV_BYPASS_AUTH === "true" &&
        import.meta.env.VITE_DEV_USER_ID;
      if (bypass) {
        setUser({ id: import.meta.env.VITE_DEV_USER_ID, email: "dev-bypass@local" } as User);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
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

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const cutoffs: Record<string, number> = {
      today: now - 24 * 60 * 60 * 1000,
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      year: now - 365 * 24 * 60 * 60 * 1000,
    };

    let result = knowledgeItems.filter((i) => {
      if (activeCategory && (i.category?.trim() ? i.category : "Uncategorized") !== activeCategory)
        return false;
      if (timeFilter !== "all" && new Date(i.created_at).getTime() < cutoffs[timeFilter])
        return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });

    return result;
  }, [knowledgeItems, activeCategory, timeFilter, sortOrder]);

  const toggleCategory = (cat: string) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
    const idx = categoryChartData.findIndex((d) => d.name === cat);
    setActivePieIndex(idx >= 0 ? idx : null);
  };

  const clearFilter = () => {
    setActiveCategory(null);
    setActivePieIndex(null);
  };

  const handleSaveEdit = async (updated: Partial<KnowledgeItem>) => {
    if (!editingItem) return;
    const res = await fetch(`/api/knowledge_items/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const { data } = await res.json();
      setKnowledgeItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...data } : i)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/knowledge_items/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKnowledgeItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const itemsByCategory = (title: string) =>
    knowledgeItems.filter(
      (i) => (i.category ?? "").toLowerCase() === title.toLowerCase(),
    );

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-12 sm:px-6 lg:px-8">
      {user && <LocationTracker userId={user.id} />}
      <div className="w-full max-w-6xl">
        <div className="relative mb-8">
          <Link
            to="/"
            aria-label="Back to homepage"
            className="absolute left-0 top-0 inline-flex rounded-full p-1 transition hover:bg-white/70"
          >
            <img
              src="/brain-mascot-cutout.png"
              alt="Recall mascot"
              className="h-12 w-12 object-contain drop-shadow-sm"
            />
          </Link>

          <div className="absolute right-0 top-0 flex items-center gap-3">
            <Settings user={user} />
            <button
              onClick={handleLogout}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
            >
              Logout
            </button>
          </div>

          <div className="mx-auto max-w-3xl pt-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Welcome</h1>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {`Your memory feed is organized here${user?.email ? `, ${user.email.split("@")[0]}` : ""}. Add more sources anytime from Connect.`}
            </p>
          </div>
        </div>

        <BentoCard className="mx-auto mb-8 max-w-5xl bg-gradient-to-r from-violet-50 to-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">Add memories</p>
              <p className="mt-0.5 text-xs text-stone-600">
                Choose a source: simulated iMessage, WeChat/WhatsApp export, or paste any thread.
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

        {/* Knowledge Sections — clickable category filter */}
        <BentoCard className="mx-auto max-w-5xl">
          <div className="mb-5 border-b border-violet-100/80 pb-4 text-center">
            <h2 className="text-lg font-semibold text-stone-900">Knowledge Sections</h2>
            <p className="mt-1 text-sm text-stone-500">
              Click a section to filter your memories. Items are classified by MiniMax at ingest time.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                onClick={clearFilter}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeCategory === null
                    ? "bg-violet-600 text-white ring-2 ring-violet-500"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                All
              </button>
              {SECTION_ITEMS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleCategory(s.title)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeCategory === s.title
                      ? "bg-violet-600 text-white ring-2 ring-violet-500"
                      : "border border-stone-200 bg-white text-stone-600 hover:border-violet-300 hover:text-violet-700"
                  }`}
                >
                  {s.title}
                  {itemsByCategory(s.title).length > 0 && (
                    <span className={`ml-1.5 ${activeCategory === s.title ? "text-violet-200" : "text-stone-400"}`}>
                      {itemsByCategory(s.title).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECTION_ITEMS.map((section) => {
              const count = itemsByCategory(section.title).length;
              const Icon = section.icon;
              const isActive = activeCategory === section.title;
              return (
                <button
                  key={section.id}
                  onClick={() => toggleCategory(section.title)}
                  className={`group flex min-h-56 flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-400"
                      : "border-violet-100 bg-violet-50/35 hover:border-violet-200 hover:bg-violet-50/60"
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${isActive ? "bg-violet-100 ring-violet-300" : "bg-white/80 ring-violet-100"}`}>
                        <Icon className={`h-5 w-5 ${isActive ? "text-violet-700" : "text-violet-600"}`} />
                      </div>
                      <p className="text-base font-semibold text-stone-900">{section.title}</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">{section.helper}</p>
                  </div>
                  <div className="mt-5">
                    <StatusBadge
                      tone={count > 0 ? "emerald" : "stone"}
                      className="normal-case tracking-normal transition-colors group-hover:border-violet-200/80 group-hover:bg-white/90"
                    >
                      {count > 0 ? `${count} saved` : "Empty"}
                    </StatusBadge>
                  </div>
                </button>
              );
            })}
          </div>
        </BentoCard>

        {/* Digital Diet pie chart — slices are clickable */}
        <BentoCard className="mx-auto mt-8 max-w-5xl">
          <div className="mb-4 border-b border-violet-100/80 pb-4">
            <h2 className="text-lg font-semibold text-stone-900">Digital diet</h2>
            <p className="mt-1 text-sm text-stone-500">
              Share of saved memories by category. Click a slice to filter memories below.{" "}
              Labels were assigned by{" "}
              <strong className="font-medium text-stone-700">MiniMax at ingest time</strong> (
              <code className="rounded bg-stone-100 px-1 text-xs">POST /api/message</code>).
            </p>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-stone-500">Loading chart…</p>
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
                    onClick={(_, index) => {
                      const entry = categoryChartData[index];
                      if (entry) toggleCategory(entry.name);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_CHART_COLORS[entry.name] ?? "#78716c"}
                        stroke={activePieIndex === index ? "#fff" : "#fff"}
                        strokeWidth={activePieIndex === index ? 3 : 1}
                        opacity={activePieIndex !== null && activePieIndex !== index ? 0.4 : 1}
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

        {user && <PersonalityCard userId={user.id} />}

        <BentoCard className="mx-auto mt-8 max-w-5xl">
          {user && <Chatbot userId={user.id} />}
        </BentoCard>

        {/* Your memories — filterable + sortable list */}
        <BentoCard className="mx-auto mt-8 max-w-5xl">
          <div className="mb-5 border-b border-violet-100/80 pb-4">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Your memories</h2>
                <p className="mt-0.5 text-sm text-stone-500">
                  {filteredItems.length} of {knowledgeItems.length} shown — click edit or delete to manage.
                </p>
              </div>
              {/* Sort toggle */}
              <button
                onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-violet-300 hover:text-violet-700"
              >
                {sortOrder === "newest" ? "↓ Newest" : "↑ Oldest"}
              </button>
            </div>

            {/* Filter bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Time filter pills */}
              {(["all", "today", "week", "month", "year"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    timeFilter === t
                      ? "bg-violet-600 text-white"
                      : "border border-stone-200 bg-white text-stone-500 hover:border-violet-300 hover:text-violet-700"
                  }`}
                >
                  {t === "all" ? "All time" : t === "today" ? "Today" : t === "week" ? "This week" : t === "month" ? "This month" : "This year"}
                </button>
              ))}

              {/* Active category chip */}
              {activeCategory && (
                <button
                  onClick={clearFilter}
                  className="flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-200"
                >
                  {activeCategory} ✕
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-center text-sm text-stone-500">Loading…</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-sm text-stone-500">
              {activeCategory || timeFilter !== "all"
                ? "No memories match these filters."
                : "Nothing yet — use Connect to paste a thread or run the iMessage agent."}
            </p>
          ) : (
            <ul className="space-y-4">
              {filteredItems.map((item) => (
                <MemoryCard
                  key={item.id}
                  item={item}
                  onEdit={setEditingItem}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </BentoCard>
      </div>

      <MemoryEditModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
