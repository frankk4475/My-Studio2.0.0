const { messagingApi } = require('@line/bot-sdk');
const User = require('../models/User');
const Settings = require('../models/Settings');

let customerClient = null;
let adminClient = null;

let config = {
  customerAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  customerSecret: process.env.LINE_CHANNEL_SECRET || '',
  adminAccessToken: process.env.LINE_ADMIN_ACCESS_TOKEN || '',
  adminSecret: process.env.LINE_ADMIN_SECRET || ''
};

/**
 * Initialize clients
 */
function initClients() {
  if (config.customerAccessToken) {
    customerClient = new messagingApi.MessagingApiClient({
      channelAccessToken: config.customerAccessToken
    });
    console.log('✅ LINE Service: Customer Client initialized');
  } else {
    customerClient = null;
  }
  
  if (config.adminAccessToken) {
    adminClient = new messagingApi.MessagingApiClient({
      channelAccessToken: config.adminAccessToken
    });
    console.log('✅ LINE Service: Admin Client initialized');
  } else if (customerClient) {
    adminClient = customerClient;
    console.log('ℹ️ LINE Service: Admin Client falling back to Customer Client');
  } else {
    adminClient = null;
  }
}

/**
 * Load settings from DB and refresh clients
 */
async function refreshConfig() {
  try {
    const settings = await Settings.findOne();
    if (settings && settings.apiKeys) {
      const keys = settings.apiKeys;
      config.customerAccessToken = keys.lineCustomerAccessToken || config.customerAccessToken;
      config.customerSecret = keys.lineCustomerSecret || config.customerSecret;
      config.adminAccessToken = keys.lineAdminAccessToken || config.adminAccessToken;
      config.adminSecret = keys.lineAdminSecret || config.adminSecret;
      
      initClients();
    } else {
        console.warn('⚠️ LINE Service: No API keys found in DB settings');
    }
  } catch (err) {
    console.error('❌ LINE Service: Failed to refresh config:', err.message);
  }
}

// Attempt initial refresh
refreshConfig();

/**
 * Notify Admins using the Admin Bot
 */
async function notifyAdmins(text) {
  if (!adminClient) await refreshConfig();
  if (!adminClient) {
    console.warn('⚠️ LINE Service: Admin Client not ready for notification');
    return;
  }
  
  try {
    const admins = await User.find({ role: 'Admin', lineUserId: { $exists: true, $ne: '' } });
    for (const admin of admins) {
      await adminClient.pushMessage({
        to: admin.lineUserId,
        messages: [{ type: 'text', text }]
      });
    }
  } catch (err) {
    console.error('LINE Notify Admin Error:', err);
  }
}

/**
 * Send message to customer using Customer Bot
 */
async function sendMessage(to, text) {
  if (!customerClient) await refreshConfig();
  if (!customerClient || !to) {
    console.warn('⚠️ LINE Service: Customer Client not ready for sendMessage');
    return;
  }

  try {
    await customerClient.pushMessage({
      to,
      messages: [{ type: 'text', text }]
    });
  } catch (err) {
    console.error('LINE Send Customer Message Error:', err);
    throw err;
  }
}

/**
 * Send message to staff/admin using Admin Bot
 */
async function sendAdminMessage(to, text) {
  if (!adminClient) await refreshConfig();
  if (!adminClient || !to) {
    console.warn('⚠️ LINE Service: Admin Client not ready for sendAdminMessage');
    return;
  }

  try {
    await adminClient.pushMessage({
      to,
      messages: [{ type: 'text', text }]
    });
  } catch (err) {
    console.error('LINE Send Admin Message Error:', err);
    throw err;
  }
}

/**
 * Send Booking Confirmation Flex Message
 */
async function sendBookingConfirmation(to, booking, baseUrl) {
  if (!customerClient) await refreshConfig();
  if (!customerClient || !to) return;

  const dateStr = new Date(booking.date).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });

  const flexMsg = {
    type: 'flex',
    altText: 'ยืนยันการจองคิวสำเร็จ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ยืนยันการจองคิว', weight: 'bold', size: 'xl', color: '#ffffff' }
        ],
        backgroundColor: '#10b981'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: booking.customer, weight: 'bold', size: 'lg' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: `📅 วันที่: ${dateStr}`, size: 'sm', color: '#666666' },
              { type: 'text', text: `⏰ เวลา: ${booking.startTime} - ${booking.endTime}`, size: 'sm', color: '#666666' },
              { type: 'text', text: `📸 งาน: ${booking.bookingType}`, size: 'sm', color: '#666666' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียดการจอง',
              uri: `${baseUrl}/booking-detail.html?id=${booking._id}`
            },
            style: 'primary',
            color: '#10b981'
          }
        ]
      }
    }
  };

  try {
    await customerClient.pushMessage({ to, messages: [flexMsg] });
  } catch (err) {
    console.error('Send Booking Confirmation Error:', err);
  }
}

/**
 * Send Quote Flex Message
 */
async function sendQuoteNotification(to, quote, baseUrl) {
  if (!customerClient) await refreshConfig();
  if (!customerClient || !to) return;

  const flexMsg = {
    type: 'flex',
    altText: `ใบเสนอราคาใหม่: ${quote.quoteNumber}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ใบเสนอราคาใหม่', weight: 'bold', size: 'xl', color: '#ffffff' }
        ],
        backgroundColor: '#4f46e5'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `เลขที่: ${quote.quoteNumber}`, weight: 'bold', size: 'md', color: '#4f46e5' },
          { type: 'text', text: quote.customerName, weight: 'bold', size: 'lg', margin: 'xs' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: `โครงการ: ${quote.projectName || '-'}`, size: 'sm', color: '#666666' },
              { type: 'text', text: `ยอดรวมสุทธิ: ${quote.grandTotal.toLocaleString()} บาท`, size: 'md', weight: 'bold', color: '#1e293b' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'เปิดดูใบเสนอราคา',
              uri: `${baseUrl}/quote-detail.html?id=${quote._id}`
            },
            style: 'primary',
            color: '#4f46e5'
          }
        ]
      }
    }
  };

  try {
    await customerClient.pushMessage({ to, messages: [flexMsg] });
  } catch (err) {
    console.error('Send Quote Notification Error:', err);
  }
}

module.exports = { 
  customerClient: () => customerClient, 
  adminClient: () => adminClient,
  config, 
  notifyAdmins, 
  sendMessage,
  sendAdminMessage,
  sendBookingConfirmation,
  sendQuoteNotification,
  refreshConfig 
};
