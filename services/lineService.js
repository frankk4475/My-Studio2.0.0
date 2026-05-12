const { messagingApi } = require('@line/bot-sdk');
const User = require('../models/User');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
};

// ใช้ MessagingApiClient สำหรับส่งข้อความ (v9+)
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

/**
 * แจ้งเตือน Admin ทุกคนที่ผูก LINE ไว้
 */
async function notifyAdmins(text) {
  if (!config.channelAccessToken) return;
  try {
    const admins = await User.find({ role: 'Admin', lineUserId: { $exists: true, $ne: '' } });
    for (const admin of admins) {
      await client.pushMessage({
        to: admin.lineUserId,
        messages: [{ type: 'text', text }]
      });
    }
  } catch (err) {
    console.error('LINE Notify Admin Error:', err);
  }
}

/**
 * ส่งข้อความหา User เฉพาะคน
 */
async function sendMessage(to, text) {
  if (!config.channelAccessToken || !to) return;
  try {
    await client.pushMessage({
      to,
      messages: [{ type: 'text', text }]
    });
  } catch (err) {
    console.error('LINE Send Message Error:', err);
  }
}

module.exports = { client, config, notifyAdmins, sendMessage };
