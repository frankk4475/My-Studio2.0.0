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

module.exports = { 
  customerClient: () => customerClient, 
  adminClient: () => adminClient,
  config, 
  notifyAdmins, 
  sendMessage, 
  refreshConfig 
};
