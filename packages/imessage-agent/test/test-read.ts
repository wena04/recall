/**
 * Test 1: 验证 iMessage SDK 能读到消息
 *
 * 前置条件:
 *   System Settings → Privacy & Security → Full Disk Access → 加上你的终端
 *
 * Run: npm run test:imessage
 */
import { IMessageSDK } from '@photon-ai/imessage-kit';

const sdk = new IMessageSDK({ debug: true });

/** When displayName is empty, show phone from chatId (e.g. iMessage;+15551234567) or a short group id. */
function formatChatLabel(chat: {
  displayName: string | null;
  chatId: string;
  isGroup: boolean;
}): string {
  const name = chat.displayName?.trim();
  if (name) return chat.isGroup ? `${name} (group)` : name;

  const id = chat.chatId;
  const tail = id.includes(';') ? id.split(';').slice(1).join(';') : id;
  const digits = tail.replace(/\s/g, '');
  if (/^\+?\d{10,15}$/.test(digits)) return digits.startsWith('+') ? digits : `+${digits}`;
  if (chat.isGroup) return `group (${id.length > 20 ? `${id.slice(0, 18)}…` : id})`;
  return id.length > 42 ? `${id.slice(0, 39)}…` : id;
}

console.log('🧪 Test: 读取 iMessage 消息\n');

try {
  // 1. 列出最近的聊天
  const chats = await sdk.listChats();
  console.log(`✅ 找到 ${chats.length} 个对话`);
  chats.slice(0, 5).forEach((chat, i) => {
    console.log(`   ${i + 1}. ${formatChatLabel(chat)}`);
  });

  // 2. 读取最近消息
  console.log('');
  const result = await sdk.getMessages({ limit: 10 });
  const msgs = result.messages || [];
  console.log(`✅ 读到 ${msgs.length} 条最近消息`);
  msgs.slice(0, 5).forEach((msg: any) => {
    const preview = (msg.text || '[非文字]').slice(0, 60);
    console.log(`   [${msg.sender || '?'}] ${preview}`);
  });

  console.log('\n🎉 iMessage 读取正常！');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('❌ 失败:', msg);
  const isDb =
    msg.includes('unable to open database') ||
    msg.includes('chat.db') ||
    (err as { code?: string })?.code === 'DATABASE';
  if (isDb || msg.includes('permission') || msg.includes('access')) {
    console.error(`
   macOS 无法打开 ~/Library/Messages/chat.db — 需要「完全磁盘访问权限」:

   1. 打开 系统设置 → 隐私与安全性 → 完全磁盘访问权限
   2. 添加下列之一（你实际用来跑 npm 的那个）:
      • Cursor.app（若在 Cursor 内置终端里跑 tsx/node）— 必须加 Cursor 本体，不是单独加 node
      • Terminal.app / iTerm 若在系统「终端」里运行
   3. 关掉并重新打开终端 / Cursor，再执行: npm run agent:test:imessage

   若仍失败: 确认「信息」应用里已有聊天记录，且当前用户是登录本机的同一账号。
`);
  }
  process.exitCode = 1;
} finally {
  try {
    await sdk.close();
  } catch {
    /* ignore close errors after DB failure */
  }
}
