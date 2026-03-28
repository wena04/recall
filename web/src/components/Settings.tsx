import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, type FormEvent } from 'react';
import { User } from '@supabase/supabase-js';

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'hourly', label: 'At most once per hour' },
  { value: 'every_6h', label: 'At most once every 6 hours' },
  { value: 'daily', label: 'At most once per day' },
  { value: 'new_city_only', label: 'Only when geocoded city changes (still rate-limited)' },
];

interface SettingsProps {
  user: User | null;
}

export default function Settings({ user }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notificationFrequency, setNotificationFrequency] = useState('daily');
  const [notificationImessageTo, setNotificationImessageTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('users')
          .select(
            'notion_token, notion_database_id, notification_frequency, notification_imessage_to',
          )
          .eq('id', user.id)
          .single();
        if (data) {
          setNotionToken(data.notion_token || '');
          setNotionDatabaseId(data.notion_database_id || '');
          setNotificationFrequency(data.notification_frequency || 'daily');
          setNotificationImessageTo(data.notification_imessage_to || '');
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

    const { error } = await supabase.from('users').upsert(
      {
        id: user.id,
        notion_token: notionToken || null,
        notion_database_id: notionDatabaseId || null,
        notification_frequency: notificationFrequency,
        notification_imessage_to: notificationImessageTo.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

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
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[92vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-6 shadow-xl shadow-violet-200/50 focus:outline-none">
          <Dialog.Title className="m-0 text-lg font-semibold text-stone-900">Settings</Dialog.Title>
          <Dialog.Description className="mb-5 mt-2 text-sm leading-normal text-stone-600">
            Notion, location pings, and iMessage delivery target.
          </Dialog.Description>
          <form onSubmit={handleSave} className="space-y-5">
            <fieldset className="flex w-full flex-col border-t border-stone-100 pt-4">
              <legend className="mb-2 text-sm font-semibold text-stone-800">Location → iMessage</legend>
              <p className="mb-3 text-xs text-stone-500">
                The dashboard shares coarse GPS with the API when not Off. Run{' '}
                <code className="rounded bg-stone-100 px-1">npm run agent:notify-poll</code> on your Mac to
                deliver queued texts via Photon.
              </p>
              <label className="mb-2 text-sm font-medium text-stone-700" htmlFor="notify-freq">
                How often Recall can message you
              </label>
              <select
                id="notify-freq"
                className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                value={notificationFrequency}
                onChange={(e) => setNotificationFrequency(e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="mb-2 mt-4 text-sm font-medium text-stone-700" htmlFor="notify-to">
                Send iMessages to (your phone number)
              </label>
              <input
                className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                id="notify-to"
                value={notificationImessageTo}
                onChange={(e) => setNotificationImessageTo(e.target.value)}
                placeholder="+1XXXXXXXXXX"
              />
            </fieldset>

            <fieldset className="flex w-full flex-col border-t border-stone-100 pt-4">
              <legend className="mb-2 text-sm font-semibold text-stone-800">Notion</legend>
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
              <label className="mb-2 mt-3 text-sm font-medium text-stone-700" htmlFor="notion-db-id">
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
