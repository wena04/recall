import { useState } from 'react';

export function FullDiskAccessModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Full Disk Access Required</h2>
        <p className="mb-4">
          To scan your iMessages, the Recall agent needs Full Disk Access. We've opened the System Settings for you.
        </p>
        <div className="text-sm text-gray-600 space-y-2">
          <p>1. In the Full Disk Access list, click the '+' button.</p>
          <p>2. Find your terminal application (e.g., Terminal, iTerm, or Visual Studio Code).</p>
          <p>3. Add it to the list and make sure the toggle is enabled.</p>
          <p>4. Quit and restart your terminal or code editor.</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={() => onOpenChange(false)}
            className="bg-violet-600 text-white px-4 py-2 rounded-md hover:bg-violet-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
