import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  SAMPLE_IMESSAGE_GROUP,
  SAMPLE_WECHAT_EXPORT,
  SAMPLE_REDNOTE_SAVED,
  SAMPLE_TIKTOK_SAVED,
} from '@/data/demoIngestSamples';
import { SOURCE_FIGURES } from '@/assets/connect/sourceFigures';
import BentoCard from '@/components/ui/BentoCard';
import StatusBadge from '@/components/ui/StatusBadge';

type SourceKind =
  | 'imessage_demo'
  | 'wechat_export'
  | 'whatsapp_export'
  | 'paste_chat'
  | 'link_note'
  | 'screenshot_caption'
  | 'xhs_favorites'
  | 'tiktok_favorites';

type SourceType = 'text' | 'url' | 'chat_export' | 'image' | 'rednote' | 'tiktok';

const SOURCES: {
  id: SourceKind;
  title: string;
  subtitle: string;
  sourceType: SourceType;
  badge?: string;
}[] = [
  {
    id: 'imessage_demo',
    title: 'iMessage group',
    subtitle: 'Demo thread, one-click load.',
    sourceType: 'chat_export',
    badge: 'Simulated',
  },
  {
    id: 'wechat_export',
    title: 'WeChat export',
    subtitle: 'Paste .txt or load sample.',
    sourceType: 'chat_export',
  },
  {
    id: 'whatsapp_export',
    title: 'WhatsApp export',
    subtitle: 'Drop your exported .txt.',
    sourceType: 'chat_export',
  },
  {
    id: 'paste_chat',
    title: 'Any chat paste',
    subtitle: 'Slack, Discord, SMS and more.',
    sourceType: 'text',
  },
  {
    id: 'xhs_favorites',
    title: '小红书 收藏夹',
    subtitle: 'Paste link + title + place.',
    sourceType: 'rednote',
    badge: 'Paste / export',
  },
  {
    id: 'tiktok_favorites',
    title: 'TikTok Saved',
    subtitle: 'Paste share link + caption.',
    sourceType: 'tiktok',
    badge: 'Paste / export',
  },
  {
    id: 'link_note',
    title: 'Link or short note',
    subtitle: 'URL, bullets, quick notes.',
    sourceType: 'url',
  },
  {
    id: 'screenshot_caption',
    title: 'Screenshot (any app)',
    subtitle: 'Paste caption and place names.',
    sourceType: 'image',
    badge: 'Text for now',
  },
];

export default function ConnectSources() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<SourceKind | null>(null);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const bypass =
        import.meta.env.VITE_DEV_BYPASS_AUTH === 'true' &&
        import.meta.env.VITE_DEV_USER_ID;
      if (bypass) {
        setUser({
          id: import.meta.env.VITE_DEV_USER_ID,
          email: 'dev-bypass@local',
        } as User);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
    };
    run();
  }, [navigate]);

  const pickSource = (id: SourceKind) => {
    setSelected(id);
    setStatus(null);
    if (id === 'imessage_demo') {
      setContent(SAMPLE_IMESSAGE_GROUP);
      return;
    }
    if (id === 'wechat_export') {
      setContent(SAMPLE_WECHAT_EXPORT);
      return;
    }
    if (id === 'xhs_favorites') {
      setContent(SAMPLE_REDNOTE_SAVED);
      return;
    }
    if (id === 'tiktok_favorites') {
      setContent(SAMPLE_TIKTOK_SAVED);
      return;
    }
    if (
      id === 'whatsapp_export' ||
      id === 'paste_chat' ||
      id === 'link_note' ||
      id === 'screenshot_caption'
    ) {
      setContent('');
    }
  };

  const currentSourceType = selected
    ? SOURCES.find((s) => s.id === selected)?.sourceType ?? 'text'
    : 'text';

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
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
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'ingest',
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
      setStatus('Saved — MiniMax is structuring this in your brain.');
      setSubmitting(false);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch {
      setStatus('Network error — is the API running on :3001?');
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

  const statusLower = status?.toLowerCase() ?? '';
  const statusTone =
    statusLower.includes('saved') || statusLower.includes('loaded')
      ? 'emerald'
      : statusLower.includes('error') || statusLower.includes('failed')
        ? 'amber'
        : 'stone';

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-10">
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
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Connect your chaos</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-stone-600">
            Pick a source card, paste content, and ingest. Visual-first flow, minimal copy.
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
                  ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200'
                  : 'hover:border-violet-200 hover:bg-white'
              }`}
            >
              <div className="overflow-hidden rounded-t-2xl border-b border-violet-100/80 bg-violet-50/40">
                {SOURCE_FIGURES[s.id]}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-900">{s.title}</span>
                  {s.badge && (
                    <StatusBadge tone="amber" className="normal-case tracking-normal text-[10px]">
                      {s.badge}
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-stone-500">{s.subtitle}</p>
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
          <form onSubmit={handleIngest}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-stone-800">
                {selected ? 'Paste content' : 'Pick a source to start'}
              </label>
              {(selected === 'wechat_export' ||
                selected === 'whatsapp_export' ||
                selected === 'paste_chat' ||
                selected === 'xhs_favorites' ||
                selected === 'tiktok_favorites') && (
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
                  ? 'Select a source card to enable input.'
                  : selected === 'screenshot_caption'
                    ? 'Caption + place names from screenshot...'
                    : selected === 'xhs_favorites'
                      ? '链接 + 标题 + 地点...'
                      : selected === 'tiktok_favorites'
                        ? 'Share link + caption + place...'
                        : 'Paste chat export, note, or link...'
              }
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-stone-50 disabled:text-stone-400"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={!selected || !content.trim() || submitting}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Ingest into Recall'}
              </button>
              {status && (
                <span className="inline-flex items-center gap-2 text-sm text-stone-600" role="status">
                  <StatusBadge tone={statusTone}>{statusTone === 'amber' ? 'Notice' : 'Status'}</StatusBadge>
                  {status}
                </span>
              )}
            </div>
          </form>
        </BentoCard>
      </div>
    </div>
  );
}
