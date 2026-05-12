const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const lineService = require('../services/lineService');
const Booking = require('../models/Booking');

// Webhook endpoint
router.post('/webhook', line.middleware(lineService.config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim();
  const userId = event.source.userId;

  // Simple Logic: Check Booking Status
  if (text.toLowerCase().startsWith('เช็คสถานะ')) {
    const customerName = text.replace(/เช็คสถานะ/i, '').trim();
    if (!customerName) {
      return lineService.client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'กรุณาระบุชื่อลูกค้า เช่น: เช็คสถานะ สมชาย' }]
      });
    }

    const booking = await Booking.findOne({ customer: new RegExp(customerName, 'i') }).sort({ createdAt: -1 });
    if (!booking) {
      return lineService.client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `ไม่พบข้อมูลการจองของ "${customerName}"` }]
      });
    }

    const statusMap = { 'Pending': '⏳ รอการยืนยัน', 'Confirmed': '✅ ยืนยันแล้ว', 'Cancelled': '❌ ยกเลิกแล้ว' };
    const dateStr = new Date(booking.date).toLocaleDateString('th-TH');
    
    return lineService.client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ 
        type: 'text', 
        text: `ข้อมูลการจองของ: ${booking.customer}\nวันที่: ${dateStr}\nสถานะ: ${statusMap[booking.status] || booking.status}` 
      }]
    });
  }

  // Default response
  return lineService.client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'สวัสดีครับ! คุณสามารถพิมพ์ "เช็คสถานะ [ชื่อ]" เพื่อดูสถานะการจองของคุณได้ครับ' }]
  });
}

module.exports = router;
