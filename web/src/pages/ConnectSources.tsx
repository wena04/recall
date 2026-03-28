import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  SAMPLE_IMESSAGE_GROUP,
  SAMPLE_WECHAT_EXPORT,
  SAMPLE_REDNOTE_SAVED,
  SAMPLE_TIKTOK_SAVED,
} from '@/data/demoIngestSamples';

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
    subtitle: 'Demo: we load a fake group thread. Real build uses Photon on your Mac.',
    sourceType: 'chat_export',
    badge: 'Simulated',
  },
  {
    id: 'wechat_export',
    title: 'WeChat export',
    subtitle: 'Paste a .txt export or use the sample transcript.',
    sourceType: 'chat_export',
  },
  {
    id: 'whatsapp_export',
    title: 'WhatsApp export',
    subtitle: 'Paste an exported chat (.txt). Same pipeline as WeChat.',
    sourceType: 'chat_export',
  },
  {
    id: 'paste_chat',
    title: 'Any chat paste',
    subtitle: 'Drop messy threads from Slack, Discord, SMS copy-paste, etc.',
    sourceType: 'text',
  },
  {
    id: 'xhs_favorites',
    title: '小红书 收藏夹',
    subtitle:
      'No bulk API: paste 链接 + 你看到的标题/地点/摘要。批量可走官方「申请个人信息副本」（慢，演示慎用）。',
    sourceType: 'rednote',
    badge: 'Paste / export',
  },
  {
    id: 'tiktok_favorites',
    title: 'TikTok Saved',
    subtitle:
      'No consumer favorites API: paste 分享链接 + on-screen caption。部分地区可申请数据下载（重、慢）。',
    sourceType: 'tiktok',
    badge: 'Paste / export',
  },
  {
    id: 'link_note',
    title: 'Link or short note',
    subtitle: 'A single URL, bullet list, or quick thought.',
    sourceType: 'url',
  },
  {
    id: 'screenshot_caption',
    title: 'Screenshot (any app)',
    subtitle:
      'Paste caption + place names from a screenshot. (Vision ingest: call POST /api/message with image_base64 from backend/scripts.)',
    sourceType: 'image',
    badge: 'Text in UI',
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleIngest = async (e: React.FormEvent) => {
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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500">
        Checking session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/80 to-stone-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
              Connect your chaos
            </h1>
            <p className="mt-1 text-sm text-stone-600 max-w-xl">
              Chats → export or paste. <strong>小红书 / TikTok 收藏</strong> → paste link + what you see on
              screen (there is <strong>no</strong> stable third‑party “sync my favorites” API for us). iMessage
              demo is <strong>simulated</strong>; real Mac path is Photon. Honest scope:{' '}
              <Link to="/" className="text-violet-700 underline">
                GOAL.md
              </Link>
              .
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mb-8">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickSource(s.id)}
              className={`text-left rounded-2xl border p-4 transition shadow-sm ${
                selected === s.id
                  ? 'border-violet-500 bg-white ring-2 ring-violet-200'
                  : 'border-stone-200 bg-white/90 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-stone-900">{s.title}</span>
                {s.badge && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    {s.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-500 leading-snug">{s.subtitle}</p>
            </button>
          ))}
        </div>

        <form
          onSubmit={handleIngest}
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <label className="text-sm font-medium text-stone-800">
              {selected ? 'Content to ingest' : 'Pick a source above'}
            </label>
            {(selected === 'wechat_export' ||
              selected === 'whatsapp_export' ||
              selected === 'paste_chat' ||
              selected === 'xhs_favorites' ||
              selected === 'tiktok_favorites') && (
              <label className="text-xs text-violet-700 font-medium cursor-pointer">
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={handleFile}
                />
                <span className="underline">Load .txt file</span>
              </label>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!selected}
            rows={12}
            placeholder={
              !selected
                ? 'Select a source to enable the editor.'
                : selected === 'screenshot_caption'
                  ? 'e.g. 抹茶专门店 @Sawtelle，人均$12，周末排队…'
                  : selected === 'xhs_favorites'
                    ? '链接 + 标题 + 地点 + 你为什么收藏…'
                    : selected === 'tiktok_favorites'
                      ? 'Paste TikTok share URL + caption / 店名 from the video…'
                      : 'Paste chat export, notes, or links…'
            }
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-stone-50 disabled:text-stone-400 font-mono"
          />
          {(selected === 'xhs_favorites' || selected === 'tiktok_favorites') && (
            <p className="mt-2 text-xs text-stone-500 leading-relaxed">
              Pitch line: we turn <strong>收藏 / Saved</strong> into structured memory — not by secretly scraping
              the app, but by ingesting <strong>what you already can copy</strong> (and later Vision on
              screenshots). Bulk personal-data exports are a separate, slow compliance path — fine to mention,
              not to fake as instant OAuth.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!selected || !content.trim() || submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? 'Sending to brain…' : 'Ingest into Recall'}
            </button>
            {status && (
              <span className="text-sm text-stone-600" role="status">
                {status}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
