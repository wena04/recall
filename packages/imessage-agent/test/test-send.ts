/**
 * Test 2: 验证 iMessage SDK 能发消息
 *
 * ⚠️ 先在 .env 里填上 MY_PHONE=+1XXXXXXXXXX
 *
 * Run: npm run test:send
 */
import 'dotenv/config';
import { IMessageSDK } from '@photon-ai/imessage-kit';

const phone = process.env.MY_PHONE;
if (!phone || phone.includes('XXX')) {
  console.error('❌ 先在 .env 里填 MY_PHONE=你的手机号');
  process.exit(1);
}

const sdk = new IMessageSDK({ debug: true });

console.log(`🧪 Test: 发消息到 ${phone}\n`);

try {
  await sdk.send(phone, '🧠 Recall test — iMessage SDK is working!');
  console.log('✅ 消息已发送！检查你的 iMessage');
} catch (err: any) {
  console.error('❌ 发送失败:', err.message);
} finally {
  await sdk.close();
}
