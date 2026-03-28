import { supabase } from '@/lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import Settings from '@/components/Settings';

interface KnowledgeItem {
  id: string;
  original_content_url: string;
  summary: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKnowledgeItems = async () => {
    if (!user) return;
    setLoading(true);
    const response = await fetch(`/api/knowledge_items/${user.id}`);
    const { data } = await response.json();
    setKnowledgeItems(data || []);
    setLoading(false);
  };

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
    if (user) {
      fetchKnowledgeItems();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.email?.split('@')[0]}
          </h1>
          <div className="flex items-center space-x-4">
            <Settings user={user} />
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Add memories</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Choose a source: simulated iMessage, WeChat/WhatsApp export, or paste any thread — same AI pipeline as{' '}
              <code className="text-[11px] bg-white/80 px-1 rounded">GOAL.md</code> Feature&nbsp;1.
            </p>
          </div>
          <Link
            to="/connect"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shrink-0"
          >
            Open Connect
          </Link>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Your Knowledge Items
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              A list of all the content you've saved and summarized.
            </p>
          </div>
          <div className="border-t border-gray-200">
            {loading ? (
              <p className="py-8 text-center text-gray-500">Loading your items...</p>
            ) : knowledgeItems.length === 0 ? (
              <p className="py-8 text-center text-gray-500">You haven't saved any items yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {knowledgeItems.map((item) => (
                  <li key={item.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-indigo-600 truncate block" title={item.original_content_url}>
                        {item.original_content_url.startsWith('http') ? (
                          <a href={item.original_content_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {item.original_content_url.slice(0, 80)}
                            {item.original_content_url.length > 80 ? '…' : ''}
                          </a>
                        ) : (
                          <span className="text-gray-800">{item.original_content_url.slice(0, 120)}{item.original_content_url.length > 120 ? '…' : ''}</span>
                        )}
                      </span>
                      <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {item.summary}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
