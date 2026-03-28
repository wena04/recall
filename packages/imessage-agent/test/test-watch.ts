/**
 * Test 3: 实时监听消息 + 检测 "recall" 触发词
 *
 * 跑起来后，在任意 iMessage 对话里发 "recall"
 * 这里会打印出来，确认 watch 通路正常
 *
 * Run: npm run test:watch
 * Ctrl+C 退出
 */
import { IMessageSDK } from '@photon-ai/imessage-kit';

const sdk = new IMessageSDK({ debug: true });

console.log('🧪 Test: 实时监听 iMessage');
console.log('   在任意对话里发消息，这里会实时打印');
console.log('   发 "recall" 会高亮显示');
console.log('   Ctrl+C 退出\n');

await sdk.startWatching({
  onDirectMessage: async (msg: any) => {
    const text = msg.text || '';
    const from = msg.sender || '?';
    if (text.toLowerCase().includes('recall')) {
      console.log(`🔥 TRIGGER! [DM] ${from}: "${text}"`);
      // 测试回复
      await sdk.send(from, '🧠 Recall detected! (test mode)');
      console.log(`   ↳ 已回复 ${from}`);
    } else {
      console.log(`📩 [DM] ${from}: "${text}"`);
    }
  },
  onGroupMessage: async (msg: any) => {
    const text = msg.text || '';
    const from = msg.sender || '?';
    if (text.toLowerCase().includes('recall')) {
      console.log(`🔥 TRIGGER! [Group] ${from}: "${text}"`);
    } else {
      console.log(`📩 [Group] ${from}: "${text}"`);
    }
  },
});

console.log('🟢 Watching... 等待消息中\n');

process.on('SIGINT', async () => {
  console.log('\n👋 停止监听');
  await sdk.close();
  process.exit(0);
});
