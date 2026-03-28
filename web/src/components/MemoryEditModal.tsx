import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import type { KnowledgeItem } from "@/components/MemoryCard";

const CATEGORIES = [
  "Food",
  "Events",
  "Sports",
  "Ideas",
  "Medical",
  "News",
  "Travel",
  "Knowledge",
];

interface Props {
  item: KnowledgeItem | null;
  onClose: () => void;
  onSave: (updated: Partial<KnowledgeItem>) => Promise<void>;
}

export default function MemoryEditModal({ item, onClose, onSave }: Props) {
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [place, setPlace] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setSummary(item.summary ?? "");
      setCategory(item.category ?? "");
      setCity(item.location_city ?? "");
      setPlace(item.location_name ?? "");
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !summary.trim()) return;
    setSaving(true);
    try {
      await onSave({
        summary: summary.trim(),
        category: category || null,
        location_city: city.trim() || null,
        location_name: place.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="mb-4 text-base font-semibold text-stone-900">
            Edit memory
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Summary
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">— none —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Los Angeles"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">
                  Place / venue
                </label>
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="e.g. Starbucks"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>

            <p className="text-[11px] text-stone-400">
              AI-extracted fields (persona, enrichment, action items) are
              read-only.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:border-stone-400">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={!summary.trim() || saving}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
