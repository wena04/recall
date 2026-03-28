import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import Settings from '@/components/Settings';
import BentoCard from '@/components/ui/BentoCard';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusBadge from '@/components/ui/StatusBadge';

interface KnowledgeItem {
  id: string;
  original_content_url: string;
  summary: string;
  created_at: string;
  category?: 'Food' | 'Events' | 'Sports' | 'Ideas' | 'Medical' | null;
  location_city?: string | null;
  location_name?: string | null;
}

interface SectionItem {
  id: string;
  title: string;
  helper: string;
}

const SECTION_ITEMS: SectionItem[] = [
  { id: 'food', title: 'Food', helper: 'Cafes, boba, and places to eat.' },
  { id: 'events', title: 'Events', helper: 'Concerts, meetups, and plans.' },
  { id: 'sports', title: 'Sports', helper: 'Games, training, and activities.' },
  { id: 'ideas', title: 'Ideas', helper: 'Concepts, drafts, and inspiration.' },
  { id: 'medical', title: 'Medical', helper: 'Health notes and reminders.' },
  { id: 'news', title: 'News', helper: 'Articles and timely updates.' },
  { id: 'travel', title: 'Travel', helper: 'Trips, cities, and destination notes.' },
  { id: 'knowledge', title: 'Knowledge', helper: 'Learning snippets and references.' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
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
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl">
        <SectionHeader
          className="mb-8"
          title="Welcome"
          description={`Your memory feed is organized here${user?.email ? `, ${user.email.split('@')[0]}` : ''}. Add more sources anytime from Connect.`}
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

        <BentoCard className="mx-auto max-w-5xl">
          <div className="mb-5 border-b border-violet-100/80 pb-4 text-center">
            <h2 className="text-lg font-semibold text-stone-900">Knowledge Sections</h2>
            <p className="mt-1 text-sm text-stone-500">
              Recall will auto-route connected content into these sections after server classification is ready.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <StatusBadge tone="violet">8 Sections</StatusBadge>
              <StatusBadge tone={loading ? 'stone' : 'emerald'}>
                {loading ? 'Syncing items...' : `${knowledgeItems.length} items ingested`}
              </StatusBadge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECTION_ITEMS.map((section) => (
              <div
                key={section.id}
                className="flex min-h-56 flex-col justify-between rounded-2xl border border-violet-100 bg-violet-50/35 p-4 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-stone-900">{section.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{section.helper}</p>
                </div>
                <div className="mt-5">
                  <StatusBadge tone="stone" className="normal-case tracking-normal">
                    Awaiting server classification
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
