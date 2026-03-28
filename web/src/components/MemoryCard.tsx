import { useState } from "react";
import { PiPencilSimple, PiTrash } from "react-icons/pi";
import StatusBadge from "@/components/ui/StatusBadge";

export interface PersonaShape {
  chat_role?: string;
  tone?: string;
  bot_likelihood?: string;
  notes?: string;
}

export interface RecallEnrichmentShape {
  keywords?: string[];
  places?: string[];
  courses_or_projects?: string[];
  texting_style?: string;
}

export interface KnowledgeItem {
  id: string;
  original_content_url: string;
  summary: string;
  created_at: string;
  category?: string | null;
  location_city?: string | null;
  location_name?: string | null;
  action_items?: { task: string; owner: string }[];
  source_context?: string | null;
  persona?: PersonaShape | Record<string, unknown> | null;
  recall_enrichment?: RecallEnrichmentShape | Record<string, unknown> | null;
  source_type?: string | null;
}

interface MemoryCardProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onDelete: (id: string) => void;
}

function isPersona(p: unknown): p is PersonaShape {
  return typeof p === "object" && p !== null && "chat_role" in p;
}

function isRecallEnrichment(r: unknown): r is RecallEnrichmentShape {
  return typeof r === "object" && r !== null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function MemoryCard({ item, onEdit, onDelete }: MemoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const persona = item.persona && isPersona(item.persona) ? item.persona : null;
  const recall =
    item.recall_enrichment && isRecallEnrichment(item.recall_enrichment)
      ? item.recall_enrichment
      : null;
  const keywords = recall?.keywords?.slice(0, 8) ?? [];
  const hasDetails = !!(
    persona ||
    keywords.length > 0 ||
    recall?.texting_style ||
    (recall?.places?.length ?? 0) > 0 ||
    (item.action_items?.length ?? 0) > 0 ||
    item.source_context ||
    item.original_content_url
  );

  return (
    <li className="group rounded-2xl border border-violet-100/90 bg-white/80 p-4 text-left shadow-sm">
      {/* Header row: summary + action icons */}
      <div className="flex items-start justify-between gap-2">
        <p
          className={`flex-1 text-sm font-semibold text-stone-900 ${
            showDetails ? "" : "line-clamp-2"
          }`}
        >
          {item.summary}
        </p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(item)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-violet-50 hover:text-violet-600"
            aria-label="Edit memory"
          >
            <PiPencilSimple className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Delete memory"
          >
            <PiTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meta row: category · location · timestamp */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.category && (
          <StatusBadge tone="violet" className="normal-case tracking-normal">
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
          <span className="text-xs text-stone-500">
            📍{" "}
            {[item.location_city, item.location_name]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        <time
          className="ml-auto text-xs text-stone-400"
          dateTime={item.created_at}
        >
          {relativeTime(item.created_at)}
        </time>
      </div>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm">
          <span className="text-red-700">Delete this memory?</span>
          <button
            onClick={() => {
              onDelete(item.id);
              setConfirmDelete(false);
            }}
            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Details toggle */}
      {hasDetails && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 text-xs text-violet-600 hover:text-violet-800"
        >
          {showDetails ? "Hide details ▾" : "Show details ▸"}
        </button>
      )}

      {showDetails && (
        <div className="mt-3 space-y-3">
          {persona && (
            <div className="rounded-xl bg-stone-50/90 px-3 py-2 text-xs text-stone-700">
              <span className="font-medium text-stone-800">Persona</span>
              <span className="text-stone-500"> · {persona.chat_role}</span>
              {persona.tone && (
                <span className="text-stone-500"> · {persona.tone}</span>
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
              <div className="rounded-xl border border-violet-100/80 bg-violet-50/40 px-3 py-2 text-xs text-stone-700">
                <p className="font-medium text-stone-800">Recall enrichment</p>
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
                    <p className="font-medium text-stone-700">Places</p>
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
            <ul className="list-inside list-disc text-xs text-stone-600">
              {item.action_items.map((a, idx) => (
                <li key={idx}>
                  {a.task}
                  {a.owner ? ` — ${a.owner}` : ""}
                </li>
              ))}
            </ul>
          )}

          {(item.original_content_url || item.source_context) && (
            <div className="text-xs text-stone-500">
              <p className="font-medium text-violet-700">
                Original &amp; source context
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-stone-600">
                {item.original_content_url}
              </p>
              {item.source_context && (
                <p className="mt-1 whitespace-pre-wrap break-words text-stone-600">
                  {item.source_context}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
