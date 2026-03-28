import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, type FormEvent } from 'react';
import { User } from '@supabase/supabase-js';

interface SettingsProps {
  user: User | null;
}

export default function Settings({ user }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('users')
          .select('notion_token, notion_database_id')
          .eq('id', user.id)
          .single();
        if (data) {
          setNotionToken(data.notion_token || '');
          setNotionDatabaseId(data.notion_database_id || '');
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({ notion_token: notionToken, notion_database_id: notionDatabaseId })
      .eq('id', user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Settings saved successfully!');
    }
    setLoading(false);
    setTimeout(() => setIsOpen(false), 1500);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-900">
          Settings
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[92vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-violet-100 bg-white p-6 shadow-xl shadow-violet-200/50 focus:outline-none">
          <Dialog.Title className="m-0 text-lg font-semibold text-stone-900">Notion Settings</Dialog.Title>
          <Dialog.Description className="mb-5 mt-2 text-sm leading-normal text-stone-600">
            Update your Notion integration details here.
          </Dialog.Description>
          <form onSubmit={handleSave}>
            <fieldset className="mb-4 flex w-full flex-col">
              <label className="mb-2 text-sm font-medium text-stone-700" htmlFor="notion-token">
                Notion API Token
              </label>
              <input
                className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                id="notion-token"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="secret_..."
              />
            </fieldset>
            <fieldset className="mb-4 flex w-full flex-col">
              <label className="mb-2 text-sm font-medium text-stone-700" htmlFor="notion-db-id">
                Notion Database ID
              </label>
              <input
                className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                id="notion-db-id"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </fieldset>
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
          {message && <div className="mt-4 text-center text-sm text-stone-600">{message}</div>}
          <Dialog.Close asChild>
            <button
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="Close"
            >
              &times;
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
