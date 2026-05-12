const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const line = require('@line/bot-sdk');
const lineService = require('../services/lineService');
const geminiService = require('../services/geminiService');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

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

    console.log(`✅ LINE Webhook: Verified request from ${botType} Bot (ID: ${destination})`);

    try {
        const results = await Promise.all(req.body.events.map(event => handleEvent(event, botType)));
        res.json(results);
    } catch (err) {
        console.error('LINE Event Handling Error:', err);
        res.status(500).end();
    }
});

async function handleEvent(event, botType) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim();
  const userId = event.source.userId;
  const client = botType === 'ADMIN' ? lineService.adminClient() : lineService.customerClient();

  if (!client) {
    console.error(`❌ LINE Client (${botType}) not initialized.`);
    return Promise.resolve(null);
  }

  // --- ADMIN BOT LOGIC (Studio Admin office) ---
  if (botType === 'ADMIN') {
      const isAdminInDB = await User.findOne({ lineUserId: userId, role: 'Admin' });
      
      // Admin Commands
      if (text.includes('สรุปงาน') || text.includes('งานวันนี้')) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const bookings = await Booking.find({ date: { $gte: today, $lt: tomorrow } });
          if (bookings.length === 0) {
              return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '📅 วันนี้ยังไม่มีรายการจองครับ' }] });
          }
          
          let report = `📅 สรุปรายการจองวันนี้ (${bookings.length} รายการ):\n`;
          bookings.forEach((b, i) => {
              report += `\n${i+1}. ${b.customer}\n   งาน: ${b.bookingType || 'ไม่ระบุ'}\n   เวลา: ${b.startTime}-${b.endTime}\n   สถานะ: ${b.status}`;
          });
          return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: report }] });
      }

      if (text.includes('ยอดค้าง') || text.includes('ยังไม่จ่าย')) {
          const unpaid = await Invoice.find({ status: { $ne: 'Paid' } }).sort({ dueDate: 1 });
          if (unpaid.length === 0) {
              return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '💰 ไม่มีรายการค้างชำระครับ' }] });
          }

          let report = `💰 รายการค้างชำระ (${unpaid.length} รายการ):\n`;
          unpaid.forEach((inv, i) => {
              report += `\n${i+1}. ${inv.customerName}\n   ยอด: ${inv.totalAmount.toLocaleString()}.- \n   ครบกำหนด: ${new Date(inv.dueDate).toLocaleDateString('th-TH')}`;
          });
          return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: report }] });
      }

      // Admin Management AI
      try {
          const aiPrompt = `คุณคือ "ผู้ช่วยบริหารจัดการสตูดิโอ" (Studio Management Assistant) 
          ทำหน้าที่ช่วยเหลือแอดมิน/เจ้าของร้านในการดูข้อมูลและจัดการระบบ 
          **ห้ามชวนลงทะเบียนหรือจองคิว** เพราะนี่คือฝั่งแอดมิน
          ชื่อแอดมิน: ${isAdminInDB ? isAdminInDB.displayName : 'Admin'}
          ข้อความจากแอดมิน: "${text}"`;
          
          const aiResponse = await geminiService.callGemini(aiPrompt);
          return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: aiResponse }] });
      } catch (e) {
          return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'สวัสดีครับแอดมิน มีอะไรให้ผมช่วยจัดการระบบไหมครับ? เช่น "สรุปงานวันนี้" หรือ "เช็คยอดค้าง"' }] });
      }
  }

  // --- CUSTOMER BOT LOGIC (Studio Admin) ---
  if (botType === 'CUSTOMER') {
      let customer = await Customer.findOne({ lineUserId: userId });
      if (!customer) {
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
      } else {
        customer.lastActive = new Date();
        await customer.save();
      }

      // Keyword: Check Status
      if (text.toLowerCase().startsWith('เช็คสถานะ')) {
        const customerName = text.replace(/เช็คสถานะ/i, '').trim();
        const query = customerName ? { customer: new RegExp(customerName, 'i') } : { lineUserId: userId };
        const booking = await Booking.findOne(query).sort({ createdAt: -1 });
        if (!booking) {
          return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'ไม่พบข้อมูลการจองของคุณครับ' }] });
        }
        const statusMap = { 'Pending': '⏳ รอการยืนยัน', 'Confirmed': '✅ ยืนยันแล้ว', 'Cancelled': '❌ ยกเลิกแล้ว' };
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: `📅 ข้อมูลการจองล่าสุด:\nคุณ: ${booking.customer}\nวันที่: ${new Date(booking.date).toLocaleDateString('th-TH')}\nสถานะ: ${statusMap[booking.status] || booking.status}` }] });
      }

      // --- BOOKING & REGISTRATION LOGIC ---
      
      // 1. Precise Template Triggers
      if (text === 'ลงทะเบียน') {
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '📝 กรุณากรอกข้อมูลเพื่อลงทะเบียนดังนี้ครับ:\n\nชื่อ-นามสกุล:\nเบอร์โทร:\nอีเมล:\nที่อยู่:' }] });
      }
      if (text === 'จอง' || text === 'จองคิว') {
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '📸 กรุณาแจ้งรายละเอียดการจองตามรูปแบบนี้เพื่อบันทึกเข้าระบบครับ:\n\nประเภทงาน:\nวันที่ (2026-05-30):\nเวลา (10:00-12:00):\nเบอร์โทรติดต่อ:\nรายละเอียดเพิ่มเติม:' }] });
      }

      // 2. Intelligent Booking Detection
      const isBookingForm = text.includes('ประเภทงาน:') && (text.includes('วันที่') || text.includes('เวลา'));
      const bookingKeywords = ['จอง', 'นัด', 'ขอคิว', 'สนใจจอง', 'เช็คคิว', 'อยากจอง', 'จองคิว', 'ว่างไหม'];
      const hasBookingKeyword = bookingKeywords.some(k => text.includes(k));
      
      // If it looks like a booking attempt (has keyword + details OR is the form)
      if (isBookingForm || (hasBookingKeyword && text.length > 5)) {
          console.log('🔍 [CUSTOMER] Potential booking detected. Analyzing...');
          try {
              let bookingData = null;

              // A. Strict Regex Parser (for form)
              if (isBookingForm) {
                  const typeMatch = text.match(/ประเภทงาน\s*:\s*(.*)/);
                  const dateMatch = text.match(/วันที่\s*\(?.*\)?:?\s*(\d{4}-\d{2}-\d{2})/);
                  const timeMatch = text.match(/เวลา\s*\(?.*\)?:?\s*(\d{2}:\d{2})\s*[-ถึง\s]\s*(\d{2}:\d{2})/);
                  const phoneMatch = text.match(/เบอร์โทร[^:]*:\s*([\d-]+)/);
                  const descMatch = text.match(/รายละเอียด[^:]*:\s*(.*)/);

                  if (dateMatch && timeMatch) {
                      bookingData = {
                          bookingType: typeMatch ? typeMatch[1].trim() : 'ไม่ระบุ',
                          date: dateMatch[1],
                          startTime: timeMatch[1],
                          endTime: timeMatch[2],
                          contactPhone: phoneMatch ? phoneMatch[1].trim() : '',
                          details: descMatch ? descMatch[1].trim() : ''
                      };
                      console.log('✅ Regex Parser Success');
                  }
              }

              // B. Gemini AI Parser (as fallback or for natural language)
              if (!bookingData) {
                  console.log('🤖 Invoking Gemini AI Parser...');
                  const aiResult = await geminiService.parseBooking(text);
                  if (aiResult && aiResult.isBooking && aiResult.date && aiResult.startTime) {
                      bookingData = aiResult;
                      console.log('✅ Gemini AI Parser Success');
                  } else {
                      console.log('ℹ️ Gemini AI did not find enough booking info.');
                  }
              }

              if (bookingData) {
                  const bDate = new Date(bookingData.date);
                  const newBooking = new Booking({
                      customer: customer.name,
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

                  // Socket.io notification
                  const socketService = require('../services/socketService');
                  socketService.emit('bookingCreated', newBooking);
                  
                  await lineService.notifyAdmins(`📢 มีการจองใหม่!\nลูกค้า: ${customer.name}\nงาน: ${newBooking.bookingType}\nวันที่: ${bookingData.date}\nเวลา: ${newBooking.startTime}-${newBooking.endTime}\nโทร: ${newBooking.contactPhone}`);
                  
                  const confirmMsg = `✅ ระบบบันทึกข้อมูลการจองเรียบร้อยครับ!\n\n📌 สรุปข้อมูล:\n- งาน: ${newBooking.bookingType}\n- วันที่: ${new Date(newBooking.date).toLocaleDateString('th-TH')}\n- เวลา: ${newBooking.startTime}${newBooking.endTime !== '00:00' ? ' - ' + newBooking.endTime : ''}\n${newBooking.contactPhone ? '- โทร: ' + newBooking.contactPhone : ''}\n\n⏳ รอเจ้าหน้าที่ตรวจสอบและยืนยันอีกครั้งนะครับ`;
                  return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: confirmMsg }] });
              }
          } catch (e) {
              console.error('❌ Booking Process Error:', e.message);
          }
      }

      // --- GENERAL AI CHAT (Fallback) ---
      try {
        const aiPrompt = `คุณคือ "Studio Assistant" ผู้ช่วยมืออาชีพของสตูดิโอถ่ายภาพ
        ชื่อลูกค้า: ${customer.name}
        คำถาม: "${text}"
        
        คำแนะนำ:
        - ถ้าลูกค้าถามเรื่องจองคิว แต่ข้อมูลยังไม่ครบ ให้บอกสิ่งที่ขาดและแนะนำให้พิมพ์ "จอง" เพื่อดูรูปแบบ
        - ถ้าลูกค้าสนใจจอง ให้ถาม: ประเภทงาน, วันที่, และเวลา
        - ตอบอย่างสุภาพและเป็นกันเอง`;
        
        const aiResponse = await geminiService.callGemini(aiPrompt);
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: aiResponse }] });
      } catch (e) {
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ? สามารถพิมพ์ "จอง" เพื่อดูขั้นตอนการจอง หรือสอบถามข้อมูลอื่นๆ ได้เลยครับ' }] });
      }
  }
}

module.exports = router;
