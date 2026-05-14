const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const line = require('@line/bot-sdk');
const lineService = require('../services/lineService');
const ollamaService = require('../services/ollamaService');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Settings = require('../models/Settings');

// --- EVENT DEDUPLICATION CACHE ---
const processedEvents = new Map(); // Store eventId -> timestamp
const CACHE_TTL = 60 * 1000; // 60 seconds

// Cleanup cache periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, timestamp] of processedEvents.entries()) {
        if (now - timestamp > CACHE_TTL) processedEvents.delete(id);
    }
}, 30000);

// Webhook endpoint for BOTH Bots (Customer & Admin)
router.post('/webhook', async (req, res) => {
    const customerSecret = lineService.config.customerSecret;
    const adminSecret = lineService.config.adminSecret;
    const destination = req.body.destination; // Bot's unique ID

    if (!customerSecret) {
        console.error('❌ LINE Webhook: Missing Channel Secret in settings!');
        return res.status(400).send('LINE Bot not configured.');
    }

    const signature = req.headers['x-line-signature'];
    if (!signature) {
        console.warn('⚠️ LINE Webhook: Missing signature header');
        return res.status(401).send('Missing signature');
    }

    const bodyString = req.rawBody ? req.rawBody : JSON.stringify(req.body);
    
    // Determine which bot this message is for by checking signatures
    let botType = null;
    
    // Check Customer Secret
    const hashCustomer = crypto.createHmac('sha256', customerSecret).update(bodyString).digest('base64');
    if (hashCustomer === signature) {
        botType = 'CUSTOMER';
    } 
    // Check Admin Secret
    else if (adminSecret) {
        const hashAdmin = crypto.createHmac('sha256', adminSecret).update(bodyString).digest('base64');
        if (hashAdmin === signature) {
            botType = 'ADMIN';
        }
    }

    if (!botType) {
        console.error('❌ LINE Webhook: Signature verification FAILED');
        console.error('Destination Bot ID:', destination);
        return res.status(401).send('Signature verification failed');
    }

    // RESPOND IMMEDIATELY TO LINE TO PREVENT TIMEOUT RETRIES
    res.status(200).send('OK');

    // Process events
    const events = req.body.events || [];
    for (const event of events) {
        const eventId = event.webhookEventId;
        
        // --- DEDUPLICATION LOGIC ---
        if (eventId && processedEvents.has(eventId)) {
            console.warn(`⏭️ Skipping duplicate event: ${eventId}`);
            continue;
        }
        if (eventId) processedEvents.set(eventId, Date.now());

        // Run handleEvent in background
        handleEvent(event, botType, req).catch(err => {
            console.error('Background Event Error:', err);
        });
    }
});

async function handleEvent(event, botType, request) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  // --- PREVENT RECURSION: Check if message is from the bot itself (if possible) ---
  // Note: LINE usually doesn't send bot's own messages back to the webhook, 
  // but we should check event.source.type
  if (event.source.type === 'bot') return null;

  const text = event.message.text.trim();
  const userId = event.source.userId;
  const client = botType === 'ADMIN' ? lineService.adminClient() : lineService.customerClient();

  if (!client) {
    console.error(`❌ LINE Client (${botType}) not initialized.`);
    return null;
  }

  // Helper to reply and exit
  const reply = async (messages) => {
    try {
        if (!event.replyToken) return;
        return await client.replyMessage({ 
            replyToken: event.replyToken, 
            messages: Array.isArray(messages) ? messages : [{ type: 'text', text: messages }] 
        });
    } catch (e) {
        // Ignore "Invalid reply token" errors in log if they happen after a timeout
        if (e.body && e.body.message === 'Invalid reply token') {
            console.warn('⚠️ LINE Reply Warning: Reply token expired or already used.');
            return;
        }
        console.error('❌ LINE Reply Error:', e.body || e.message);
    }
  };

  // --- ADMIN BOT LOGIC (Studio Admin office) ---
  if (botType === 'ADMIN') {
      let staffUser = await User.findOne({ lineUserId: userId });
      
      // Special Command: Link Staff Account
      if (text.startsWith('#link-staff ')) {
          const targetUsername = text.replace('#link-staff ', '').trim();
          const userToLink = await User.findOne({ username: targetUsername });
          
          if (!userToLink) {
              return reply(`❌ ไม่พบชื่อผู้ใช้ "${targetUsername}" ในระบบครับ`);
          }
          
          userToLink.lineUserId = userId;
          await userToLink.save();
          
          // Clean up if they were accidentally added as a customer
          await Customer.deleteOne({ lineUserId: userId });
          
          return reply(`✅ เชื่อมต่อบัญชี LINE กับพนักงาน "${userToLink.displayName || userToLink.username}" เรียบร้อยแล้วครับ!`);
      }

      // Admin Commands
      if (text.includes('สรุปงาน') || text.includes('งานวันนี้')) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const bookings = await Booking.find({ date: { $gte: today, $lt: tomorrow } });
          if (bookings.length === 0) {
              return reply('📅 วันนี้ยังไม่มีรายการจองครับ');
          }
          
          let report = `📅 สรุปรายการจองวันนี้ (${bookings.length} รายการ):\n`;
          bookings.forEach((b, i) => {
              report += `\n${i+1}. ${b.customer}\n   งาน: ${b.bookingType || 'ไม่ระบุ'}\n   เวลา: ${b.startTime}-${b.endTime}\n   สถานะ: ${b.status}`;
          });
          return reply(report);
      }

      if (text.includes('ยอดค้าง') || text.includes('ยังไม่จ่าย')) {
          const unpaid = await Invoice.find({ status: { $ne: 'Paid' } }).sort({ dueDate: 1 });
          if (unpaid.length === 0) {
              return reply('💰 ไม่มีรายการค้างชำระครับ');
          }

          let report = `💰 รายการค้างชำระ (${unpaid.length} รายการ):\n`;
          unpaid.forEach((inv, i) => {
              report += `\n${i+1}. ${inv.customerName}\n   ยอด: ${inv.totalAmount.toLocaleString()}.- \n   ครบกำหนด: ${new Date(inv.dueDate).toLocaleDateString('th-TH')}`;
          });
          return reply(report);
      }

      // Admin Management AI
      try {
          const aiPrompt = `คุณคือ "ผู้ช่วยบริหารจัดการสตูดิโอ" (Studio Management Assistant) 
          ทำหน้าที่ช่วยเหลือแอดมิน/เจ้าของร้านในการดูข้อมูลและจัดการระบบ 
          **กฎเหล็ก: ต้องตอบเป็นภาษาไทยเท่านั้น**
          **ห้ามชวนลงทะเบียนหรือจองคิว** เพราะนี่คือฝั่งแอดมิน
          ชื่อแอดมิน: ${staffUser ? staffUser.displayName || staffUser.username : 'Admin'}
          ข้อความจากแอดมิน: "${text}"`;
          
          const aiResponse = await ollamaService.callAI(aiPrompt);
          return reply(aiResponse);
      } catch (e) {
          return reply('สวัสดีครับแอดมิน มีอะไรให้ผมช่วยจัดการระบบไหมครับ? เช่น "สรุปงานวันนี้" หรือ "เช็คยอดค้าง"');
      }
  }

  // --- CUSTOMER BOT LOGIC (Studio Admin) ---
  if (botType === 'CUSTOMER') {
      // 1. Check if this is a known Staff member
      const isStaff = await User.findOne({ lineUserId: userId });
      let customer = await Customer.findOne({ lineUserId: userId });

      if (!customer && !isStaff) {
        try {
          const profile = await client.getProfile(userId);
          customer = new Customer({
            name: profile.displayName || 'LINE User',
            lineUserId: userId,
            lineDisplayName: profile.displayName,
            linePictureUrl: profile.pictureUrl,
            lastActive: new Date()
          });
          await customer.save();
        } catch (e) {
          customer = new Customer({ name: 'LINE User', lineUserId: userId, lastActive: new Date() });
          await customer.save();
        }
      } else if (customer) {
        customer.lastActive = new Date();
        await customer.save();
      }

      // Keyword: Check Status
      if (text.toLowerCase().startsWith('เช็คสถานะ')) {
        const customerName = text.replace(/เช็คสถานะ/i, '').trim();
        const query = customerName ? { customer: new RegExp(customerName, 'i') } : { lineUserId: userId };
        const booking = await Booking.findOne(query).sort({ createdAt: -1 });
        if (!booking) {
          return reply('ไม่พบข้อมูลการจองของคุณครับ');
        }
        const statusMap = { 'Pending': '⏳ รอการยืนยัน', 'Confirmed': '✅ ยืนยันแล้ว', 'Cancelled': '❌ ยกเลิกแล้ว' };
        return reply(`📅 ข้อมูลการจองล่าสุด:\nคุณ: ${booking.customer}\nวันที่: ${new Date(booking.date).toLocaleDateString('th-TH')}\nสถานะ: ${statusMap[booking.status] || booking.status}`);
      }

      // --- BOOKING & REGISTRATION LOGIC ---
      
      // 1. Precise Template Triggers
      if (text === 'ลงทะเบียน' || text.toLowerCase() === 'register' || text === 'สมัครสมาชิก') {
        // Build the full URL properly - with safety checks for request
        let protocol = 'http';
        let host = 'localhost:3000'; // Default fallback

        if (request && request.headers) {
            protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
            host = request.get('host');
        } else {
            console.warn('⚠️ Warning: request is undefined in handleEvent registration logic');
        }
        
        // Ensure userId is present
        if (!userId) {
            console.error('❌ Missing userId for registration');
            return reply('ขออภัยครับ ไม่สามารถดึงรหัสผู้ใช้เพื่อลงทะเบียนได้ กรุณาลองใหม่ภายหลัง');
        }
        
        const regUrl = `${protocol}://${host}/register.html?userId=${userId}`;
        console.log('🔗 Generated Registration URL:', regUrl);

        return reply([{
            type: 'template',
            altText: 'กรุณาลงทะเบียนข้อมูลลูกค้า',
            template: {
              type: 'buttons',
              thumbnailImageUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c491?q=80&w=2070&auto=format&fit=crop',
              title: 'ลงทะเบียนลูกค้า',
              text: 'กรุณาคลิกปุ่มด้านล่างเพื่อกรอกข้อมูลลงทะเบียนครับ',
              actions: [{ type: 'uri', label: '📝 เริ่มการลงทะเบียน', uri: regUrl }]
            }
          }]);
      }

      if (text === 'จอง' || text === 'จองคิว') {
        const bookingTemplate = `📸 *รบกวนแจ้งข้อมูลการจองดังนี้ครับ*
(ก๊อปปี้ข้อความด้านล่างไปแก้ไขได้เลย)

• ประเภทงาน: 
• วันที่: 
• เวลา: 
• เบอร์โทร: 
• รายละเอียด: 

*ตัวอย่าง: วันที่ 2026-05-30 / เวลา 10:00-12:00*`;
        return reply(bookingTemplate);
      }

      // 2. Intelligent Booking Detection
      const isBookingForm = (text.includes('ประเภทงาน') || text.includes('วันที่')) && (text.includes('เวลา') || text.includes('เบอร์โทร'));
      const bookingKeywords = ['จอง', 'นัด', 'ขอคิว', 'สนใจจอง', 'เช็คคิว', 'อยากจอง', 'จองคิว', 'ว่างไหม'];
      const hasBookingKeyword = bookingKeywords.some(k => text.includes(k));
      
      if (isBookingForm || (hasBookingKeyword && text.length > 5)) {
          console.log('🔍 [CUSTOMER] Potential booking detected...');
          try {
              let bookingData = null;

              if (isBookingForm) {
                  const typeMatch = text.match(/ประเภทงาน\s*[:]\s*(.*)/);
                  const dateMatch = text.match(/วันที่\s*[^:]*[:]\s*(\d{4}-\d{2}-\d{2})/);
                  const timeMatch = text.match(/เวลา\s*[^:]*[:]\s*(\d{2}:\d{2})\s*[-ถึง\s]\s*(\d{2}:\d{2})/);
                  const phoneMatch = text.match(/เบอร์โทร[^:]*[:]\s*([\d-]+)/);
                  const descMatch = text.match(/รายละเอียด[^:]*[:]\s*(.*)/);

                  if (dateMatch && timeMatch) {
                      bookingData = {
                          bookingType: typeMatch ? typeMatch[1].trim() : 'ไม่ระบุ',
                          date: dateMatch[1],
                          startTime: timeMatch[1],
                          endTime: timeMatch[2],
                          contactPhone: phoneMatch ? phoneMatch[1].trim() : '',
                          details: descMatch ? descMatch[1].trim() : ''
                      };
                  }
              }

              if (!bookingData) {
                  const aiResult = await ollamaService.parseBooking(text);
                  if (aiResult && aiResult.isBooking && aiResult.date && aiResult.startTime) {
                      bookingData = aiResult;
                  }
              }

              if (bookingData) {
                  const bDate = new Date(bookingData.date);
                  const newBooking = new Booking({
                      customer: customer ? customer.name : 'LINE User',
                      lineUserId: userId,
                      date: bDate,
                      startTime: bookingData.startTime,
                      endTime: bookingData.endTime || '00:00',
                      bookingType: bookingData.bookingType || 'ไม่ระบุ',
                      contactPhone: bookingData.contactPhone || '',
                      details: bookingData.details || '',
                      status: 'Pending'
                  });
                  await newBooking.save();

                  const socketService = require('../services/socketService');
                  socketService.emit('bookingCreated', newBooking);
                  await lineService.notifyAdmins(`📢 มีการจองใหม่!\nลูกค้า: ${newBooking.customer}\nงาน: ${newBooking.bookingType}\nวันที่: ${bookingData.date}\nเวลา: ${newBooking.startTime}-${newBooking.endTime}`);
                  
                  return reply(`✅ ระบบบันทึกข้อมูลการจองเรียบร้อยครับ!\n\n📌 สรุปข้อมูล:\n- งาน: ${newBooking.bookingType}\n- วันที่: ${new Date(newBooking.date).toLocaleDateString('th-TH')}\n- เวลา: ${newBooking.startTime}${newBooking.endTime !== '00:00' ? ' - ' + newBooking.endTime : ''}\n\n⏳ รอเจ้าหน้าที่ตรวจสอบและยืนยันอีกครั้งนะครับ`);
              }
          } catch (e) {
              console.error('❌ Booking Process Error:', e.message);
          }
      }

      // --- GENERAL AI CHAT (Fallback with Structured Memory) ---
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
        const timeStr = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

        // 1. Fetch Context Data (RAG)
        const recentBookings = await Booking.find({ lineUserId: userId }).sort({ date: -1 }).limit(3);
        const settings = await Settings.findOne();
        
        let contextInfo = `ข้อมูลปัจจุบัน: วัน${dateStr} เวลา ${timeStr}\n`;
        contextInfo += `ชื่อลูกค้า: ${customer ? customer.name : 'ยังไม่ลงทะเบียน'}\n`;
        
        if (recentBookings.length > 0) {
            contextInfo += `รายการจองล่าสุดของคุณ:\n`;
            recentBookings.forEach(b => {
                contextInfo += `- ${b.bookingType} วันที่ ${new Date(b.date).toLocaleDateString('th-TH')} สถานะ: ${b.status}\n`;
            });
        }

        if (settings && settings.business) {
            contextInfo += `ข้อมูลสตูดิโอ: ${settings.business.name || 'My Studio'}\n`;
            if (settings.business.address) contextInfo += `ที่อยู่: ${settings.business.address}\n`;
        }

        // 2. Build Messages Array for Chat API
        const messages = [];
        
        // Add System Context
        messages.push({ 
            role: 'system', 
            content: `บริบทจากระบบสตูดิโอ:\n${contextInfo}\nกรุณาใช้ข้อมูลนี้ตอบลูกค้าอย่างเป็นธรรมชาติที่สุด` 
        });

        // Add History
        if (customer && customer.recentMessages && customer.recentMessages.length > 0) {
            customer.recentMessages.forEach(msg => {
                messages.push({ role: msg.role, content: msg.content });
            });
        }

        // Add Current User Message
        messages.push({ role: 'user', content: text });

        // 3. Call Chat AI
        const aiResponse = await ollamaService.callChatAI(messages);
        
        // 4. Save to History (Limit to 10 messages)
        if (customer) {
            customer.recentMessages.push({ role: 'user', content: text });
            customer.recentMessages.push({ role: 'assistant', content: aiResponse });
            if (customer.recentMessages.length > 10) {
                customer.recentMessages = customer.recentMessages.slice(-10);
            }
            await customer.save();
        }

        // Auto-Filter for Admin Notification
        const urgentKeywords = ['ขอลด', 'ถูกกว่านี้', 'ด่วนที่สุด', 'ขอคุยกับแอดมิน', 'ร้องเรียน', 'ปัญหา'];
        const isUrgent = urgentKeywords.some(k => text.includes(k));
        
        if (isUrgent) {
            await lineService.notifyAdmins(`⚠️ [ด่วน] ลูกค้าต้องการความช่วยเหลือพิเศษ:\nลูกค้า: ${customer ? customer.name : 'LINE User'}\nข้อความ: "${text}"`);
        }

        return reply(aiResponse);
      } catch (e) {
        console.error('❌ AI Chat Error:', e);
        return reply('สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ? สามารถพิมพ์ "จอง" เพื่อดูขั้นตอนการจองได้เลยครับ');
      }
  }
}

module.exports = router;
