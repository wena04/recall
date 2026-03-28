
import './load-agent-env.js';
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import { scanAllChatsAndIngest } from './scan-all-chats.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.AGENT_PORT || 3002;

const RECALL_MAX_CHATS_SCAN = parseInt(process.env.RECALL_MAX_CHATS_SCAN || '15', 10);
const RECALL_MESSAGES_PER_CHAT_SCAN = parseInt(process.env.RECALL_MESSAGES_PER_CHAT_SCAN || '120', 10);
const RECALL_INGEST_DELAY_MS = parseInt(process.env.RECALL_INGEST_DELAY_MS || '1500', 10);
const RECALL_DEMO_HINT = process.env.RECALL_DEMO_HINT?.trim() || '';

app.post('/scan-all', async (req, res) => {
  console.log('Received request to scan all chats.');
  const sdk = new IMessageSDK({ debug: false });
  try {
    const result = await scanAllChatsAndIngest(sdk, {
      maxChats: RECALL_MAX_CHATS_SCAN,
      messagesPerChat: RECALL_MESSAGES_PER_CHAT_SCAN,
      delayMs: RECALL_INGEST_DELAY_MS,
      demoHint: RECALL_DEMO_HINT || undefined,
    });
    console.log('Scan complete:', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error during scan:', error);
    if (error.message.includes('unable to open database file') || error.code === 'SQLITE_CANTOPEN') {
      console.log('Permission error detected. Opening Full Disk Access settings.');
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"');
      res.status(403).json({
        error: 'FULL_DISK_ACCESS_REQUIRED',
        message: 'The iMessage agent requires Full Disk Access to read your chat history. Please grant access in System Settings.',
      });
    } else {
      res.status(500).json({ error: 'SCAN_FAILED', message: error.message });
    }
  } finally {
    await sdk.close();
  }
});

app.listen(PORT, () => {
  console.log(`iMessage agent server listening on http://localhost:${PORT}`);
});
