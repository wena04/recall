import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { SOURCE_FIGURES } from "@/assets/connect/sourceFigures";
import { FullDiskAccessModal } from "@/components/FullDiskAccessModal";
import BentoCard from "@/components/ui/BentoCard";
import StatusBadge from "@/components/ui/StatusBadge";

type SourceKind =
  | "imessage_photon"
  | "wechat_export"
  | "whatsapp_export"
  | "paste_chat"
  | "link_note"
  | "screenshot_caption"
  | "xhs_favorites"
  | "tiktok_favorites";

type SourceType =
  | "text"
  | "url"
  | "chat_export"
  | "image"
  | "rednote"
  | "tiktok";

const SOURCES: {
  id: SourceKind;
  title: string;
  subtitle: string;
  sourceType: SourceType;
  badge?: string;
}[] = [
  {
    id: "imessage_photon",
    title: "iMessage (Live)",
    subtitle: "Scan all chats via Photon agent.",
    sourceType: "chat_export",
    badge: "Local agent",
  },
  {
    id: "wechat_export",
    title: "WeChat export",
    subtitle: "Paste your exported .txt.",
    sourceType: "chat_export",
  },
  {
    id: "whatsapp_export",
    title: "WhatsApp export",
    subtitle: "Drop your exported .txt.",
    sourceType: "chat_export",
  },
  {
    id: "paste_chat",
    title: "Any chat paste",
    subtitle: "Slack, Discord, SMS and more.",
    sourceType: "text",
  },
  {
    id: "xhs_favorites",
    title: "小红书 收藏夹",
    subtitle: "Paste link + title + place.",
    sourceType: "rednote",
    badge: "Paste / export",
  },
  {
    id: "tiktok_favorites",
    title: "TikTok Saved",
    subtitle: "Paste share link + caption.",
    sourceType: "tiktok",
    badge: "Paste / export",
  },
  {
    id: "link_note",
    title: "Link or short note",
    subtitle: "URL, bullets, quick notes.",
    sourceType: "url",
  },
  {
    id: "screenshot_caption",
    title: "Screenshot (any app)",
    subtitle: "Paste caption and place names.",
    sourceType: "image",
    badge: "Text for now",
  },
];

export default function ConnectSources() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<SourceKind | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "scanning" | "done" | "error" | "cancelled"
  >("idle");
  const [scanResult, setScanResult] = useState<{
    scanned: number;
    ingested: number;
    skippedEmpty: number;
    failed: number;
  } | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    currentChat: string;
    chatsDone: number;
    chatsTotal: number;
    ingested: number;
    skippedEmpty: number;
    failed: number;
    log: string[];
  } | null>(null);
  const [showFdaModal, setShowFdaModal] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    const run = async () => {
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
    run();
  }, [navigate]);

  // Poll scan status while scanning (progress comes from Mac agent → POST /api/imessage/scan-progress)
  useEffect(() => {
    if (scanStatus !== "scanning" || !user) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/imessage/scan-status?userId=${user.id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.progress) setScanProgress(json.progress);
        if (json.status === "done") {
          setScanStatus("done");
          setScanResult(json.result ?? null);
        } else if (json.status === "cancelled") {
          setScanStatus("cancelled");
          setScanResult(json.result ?? null);
        } else if (json.status === "error") {
          const msg =
            json.errorMessage ??
            "Scan failed. If you saw a permissions error on the Mac, grant Full Disk Access to the app running Node.";
          if (/unable to open database|SQLITE_CANTOPEN|full disk access/i.test(msg)) {
            setShowFdaModal(true);
          }
          setScanStatus("error");
          setScanErrorMsg(msg);
        }
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(() => void poll(), 1000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scanStatus, user]);

  const handleScanTrigger = async () => {
    if (!user) return;
    setScanStatus("scanning");
    setScanResult(null);
    setScanErrorMsg(null);
    setScanProgress(null);
    setShowFdaModal(false);
    try {
      const res = await fetch("/api/imessage/scan-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      if (res.status === 503 || json.status === "error") {
        setScanStatus("error");
        setScanErrorMsg(
          json.error ??
            "Mac agent is not connected. Run `npm run dev` on this Mac and keep the `agent` process running; grant Full Disk Access to the app running Node.",
        );
        return;
      }
      if (!res.ok) {
        setScanStatus("error");
        setScanErrorMsg(json.error ?? `Request failed (${res.status})`);
      }
      // status === scanning: polling useEffect will stream progress + completion
    } catch (err: unknown) {
      setScanStatus("error");
      setScanErrorMsg(err instanceof Error ? err.message : "Network error — is the API running?");
    }
  };

  const handleScanCancel = async () => {
    if (!user) return;
    try {
      await fetch("/api/imessage/scan-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {
      /* ignore */
    }
  };

  const pickSource = (id: SourceKind) => {
    setSelected(id);
    setStatus(null);
    if (id === "imessage_photon") {
      setContent("");
      return;
    }
    if (
      id === "wechat_export" ||
      id === "xhs_favorites" ||
      id === "tiktok_favorites" ||
      id === "whatsapp_export" ||
      id === "paste_chat" ||
      id === "link_note" ||
      id === "screenshot_caption"
    ) {
      setContent("");
    }
  };

  const currentSourceType = selected
    ? (SOURCES.find((s) => s.id === selected)?.sourceType ?? "text")
    : "text";

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setContent(reader.result);
        setStatus(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleIngest = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim() || !selected) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          type: "ingest",
          content: content.trim(),
          source_type: currentSourceType,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(json.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      setStatus("Saved — MiniMax is structuring this in your brain.");
      setSubmitting(false);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch {
      setStatus("Network error — is the API running on :3001?");
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50/80 to-stone-50">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-4 py-2 text-sm text-stone-600 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          Checking session...
        </div>
      </div>
    );
  }

  const statusLower = status?.toLowerCase() ?? "";
  const statusTone =
    statusLower.includes("saved") || statusLower.includes("loaded")
      ? "emerald"
      : statusLower.includes("error") || statusLower.includes("failed")
        ? "amber"
        : "stone";

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-10">
      <FullDiskAccessModal open={showFdaModal} onOpenChange={setShowFdaModal} />
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="mb-3">
            <Link
              to="/dashboard"
              className="inline-flex rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-900"
            >
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Connect your chaos
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-stone-600">
            Pick a source card, paste content, and ingest. Visual-first flow,
            minimal copy.
          </p>
        </div>

        <div className="mb-4 flex justify-center gap-2">
          <StatusBadge tone="violet" className="normal-case tracking-normal">
            Centered workflow
          </StatusBadge>
          <StatusBadge tone="stone" className="normal-case tracking-normal">
            Select source - paste - ingest
          </StatusBadge>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <BentoCard
              key={s.id}
              as="button"
              onClick={() => pickSource(s.id)}
              className={`w-full p-0 text-left transition ${
                selected === s.id
                  ? "border-violet-400 bg-violet-50/60 ring-2 ring-violet-200"
                  : "hover:border-violet-200 hover:bg-white"
              }`}
            >
              <div className="overflow-hidden rounded-t-2xl border-b border-violet-100/80 bg-violet-50/40">
                {SOURCE_FIGURES[s.id]}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-900">{s.title}</span>
                  {s.badge && (
                    <StatusBadge
                      tone="amber"
                      className="normal-case tracking-normal text-[10px]"
                    >
                      {s.badge}
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  {s.subtitle}
                </p>
                {selected === s.id && (
                  <div className="mt-3">
                    <StatusBadge tone="violet">Selected</StatusBadge>
                  </div>
                )}
              </div>
            </BentoCard>
          ))}
        </div>

        <BentoCard className="mx-auto max-w-3xl">
          {selected === "imessage_photon" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-stone-800">
                Scan all iMessage chats
              </p>
              <p className="text-sm text-stone-500">
                <strong className="font-medium text-stone-700">
                  From the repo root,{" "}
                  <code className="rounded bg-stone-100 px-1 text-xs font-normal">
                    npm run dev
                  </code>{" "}
                  starts the web app, API, and Photon agent together.
                </strong>{" "}
                Scan talks to one shared Mac agent over WebSocket —{" "}
                <strong className="font-medium text-stone-700">
                  whoever is logged into Recall here is the account we ingest into
                </strong>
                . You do <strong className="font-medium text-stone-700">not</strong>{" "}
                need to change <code className="text-xs">SECOND_BRAIN_USER_ID</code>{" "}
                when switching users (still set it once if you use iMessage{" "}
                <code className="text-xs">recall</code> automation as a default
                account).
              </p>
              <details className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
                <summary className="cursor-pointer font-medium text-stone-700">
                  Why isn’t this just “read my disk” from the website?
                </summary>
                <p className="mt-2 leading-relaxed">
                  Browsers are not allowed to open{" "}
                  <code className="rounded bg-white px-0.5">chat.db</code> or
                  other files on your Mac. A small local program (this repo’s{" "}
                  <strong>agent</strong>, using Photon) runs next to Messages,
                  reads history with Full Disk Access, and talks to the API over
                  a WebSocket. Supabase is one database for the whole app; your
                  rows are scoped by your user id, not a separate database per
                  person.
                </p>
              </details>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-stone-700">
                <span className="shrink-0 text-stone-500">
                  This session’s user id (ingest target):
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-stone-800">
                  {user.id}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(user.id);
                    setCopiedUid(true);
                    setTimeout(() => setCopiedUid(false), 2000);
                  }}
                  className="shrink-0 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                >
                  {copiedUid ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanTrigger}
                  disabled={scanStatus === "scanning"}
                  className="w-fit rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {scanStatus === "scanning" ? "Scanning..." : "Scan All Chats"}
                </button>
                {scanStatus === "scanning" && (
                  <button
                    type="button"
                    onClick={() => void handleScanCancel()}
                    className="w-fit rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
                  >
                    Stop scanning
                  </button>
                )}
              </div>
              {scanStatus === "scanning" && (
                <div className="flex flex-col gap-2">
                  {scanProgress ? (
                    <>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full rounded-full bg-violet-500 transition-all duration-500 ${
                            scanProgress.chatsTotal === 0 ? "animate-pulse w-1/3" : ""
                          }`}
                          style={
                            scanProgress.chatsTotal > 0
                              ? {
                                  width: `${Math.round((scanProgress.chatsDone / scanProgress.chatsTotal) * 100)}%`,
                                }
                              : undefined
                          }
                        />
                      </div>
                      {/* Stats row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                          {scanProgress.chatsTotal > 0
                            ? `${scanProgress.chatsDone}/${scanProgress.chatsTotal} chats`
                            : "Preparing…"}
                        </span>
                        <span className="text-emerald-600">
                          ✦ {scanProgress.ingested} saved
                        </span>
                        {scanProgress.skippedEmpty > 0 && (
                          <span>{scanProgress.skippedEmpty} skipped</span>
                        )}
                        {scanProgress.failed > 0 && (
                          <span className="text-amber-600">
                            {scanProgress.failed} failed
                          </span>
                        )}
                      </div>
                      {/* Current chat */}
                      <p className="truncate text-xs text-stone-400">
                        {scanProgress.currentChat
                          ? `Scanning ${scanProgress.currentChat}…`
                          : "Starting…"}
                      </p>
                      {/* Live log */}
                      {scanProgress.log.length > 0 && (
                        <div className="max-h-32 overflow-y-auto rounded-lg bg-stone-50 p-2 font-mono text-[11px] text-stone-500">
                          {[...scanProgress.log].reverse().map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith("✦")
                                  ? "text-emerald-600"
                                  : line.startsWith("✗")
                                    ? "text-amber-600"
                                    : ""
                              }
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 text-sm text-stone-600">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                        Waiting for live progress from your Mac agent…
                      </span>
                      <p className="text-xs text-stone-400">
                        If this never updates, confirm the `agent` tab in your `npm run dev`
                        terminal is running and the API is on the same machine.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {scanStatus === "cancelled" && scanResult && (
                <StatusBadge
                  tone="amber"
                  className="normal-case tracking-normal w-fit max-w-full text-left"
                >
                  Stopped — saved {scanResult.ingested} chats before stop ·{" "}
                  {scanResult.skippedEmpty ?? 0} skipped · {scanResult.failed} failed (
                  {scanResult.scanned} threads scanned)
                </StatusBadge>
              )}
              {scanStatus === "done" && scanResult && (
                <StatusBadge
                  tone={scanResult.ingested > 0 ? "emerald" : "amber"}
                  className="normal-case tracking-normal w-fit"
                >
                  {scanResult.ingested > 0
                    ? `Done — ${scanResult.ingested} ingested · ${scanResult.skippedEmpty ?? 0} empty · ${scanResult.failed} failed (${scanResult.scanned} scanned)`
                    : `0 ingested — ${scanResult.skippedEmpty ?? 0} chats had no text messages. Check [agent] log for details.`}
                </StatusBadge>
              )}
              {scanStatus === "error" && (
                <StatusBadge
                  tone="amber"
                  className="normal-case tracking-normal w-fit"
                >
                  Error: {scanErrorMsg}
                </StatusBadge>
              )}
            </div>
          ) : (
            <form onSubmit={handleIngest}>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-medium text-stone-800">
                  {selected ? "Paste content" : "Pick a source to start"}
                </label>
                {(selected === "wechat_export" ||
                  selected === "whatsapp_export" ||
                  selected === "paste_chat" ||
                  selected === "xhs_favorites" ||
                  selected === "tiktok_favorites") && (
                  <label className="cursor-pointer text-xs font-medium text-violet-700">
                    <input
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={handleFile}
                    />
                    <span className="underline">Upload .txt</span>
                  </label>
                )}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!selected}
                rows={10}
                placeholder={
                  !selected
                    ? "Select a source card to enable input."
                    : selected === "screenshot_caption"
                      ? "Caption + place names from screenshot..."
                      : selected === "xhs_favorites"
                        ? "链接 + 标题 + 地点..."
                        : selected === "tiktok_favorites"
                          ? "Share link + caption + place..."
                          : "Paste chat export, note, or link..."
                }
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-stone-50 disabled:text-stone-400"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={!selected || !content.trim() || submitting}
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Ingest into Recall"}
                </button>
                {status && (
                  <span
                    className="inline-flex items-center gap-2 text-sm text-stone-600"
                    role="status"
                  >
                    <StatusBadge tone={statusTone}>
                      {statusTone === "amber" ? "Notice" : "Status"}
                    </StatusBadge>
                    {status}
                  </span>
                )}
              </div>
            </form>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
