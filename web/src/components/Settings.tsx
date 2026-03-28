import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
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
        const { data, error } = await supabase
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

  const handleSave = async (e: React.FormEvent) => {
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
        <button className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700">
          Settings
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/40 data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="text-mauve12 m-0 text-[17px] font-medium">Notion Settings</Dialog.Title>
          <Dialog.Description className="text-mauve11 mt-[10px] mb-5 text-[15px] leading-normal">Update your Notion integration details here.</Dialog.Description>
          <form onSubmit={handleSave}>
            <fieldset className="mb-[15px] w-full flex flex-col justify-start">
              <label className="text-violet11 mb-2.5 text-[15px]" htmlFor="notion-token">Notion API Token</label>
              <input
                className="text-violet11 shadow-violet7 focus:shadow-violet8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]"
                id="notion-token"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="secret_..."
              />
            </fieldset>
            <fieldset className="mb-[15px] w-full flex flex-col justify-start">
              <label className="text-violet11 mb-2.5 text-[15px]" htmlFor="notion-db-id">Notion Database ID</label>
              <input
                className="text-violet11 shadow-violet7 focus:shadow-violet8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]"
                id="notion-db-id"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </fieldset>
            <div className="mt-[25px] flex justify-end">
              <button type="submit" disabled={loading} className="bg-green4 text-green11 hover:bg-green5 focus:shadow-green7 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-medium leading-none focus:shadow-[0_0_0_2px] focus:outline-none disabled:opacity-50">
                {loading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
          {message && <div className="mt-4 text-center text-sm text-gray-600">{message}</div>}
          <Dialog.Close asChild>
            <button
              className="text-violet11 hover:bg-violet4 focus:shadow-violet7 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
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
