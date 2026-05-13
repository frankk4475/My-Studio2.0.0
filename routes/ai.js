const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollamaService');
const Booking = require('../models/Booking');
const Quote = require('../models/Quote');

// Helper to clean JSON response from AI
const parseAIJson = (text) => {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse AI JSON:', e, text);
    throw new Error('AI returned invalid JSON');
  }
};

/**
 * POST /api/ai/suggest-quote
 * Suggests quote items based on booking details
 */
router.post('/suggest-quote', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const prompt = `
      คุณคือผู้จัดการสตูดิโอถ่ายภาพมืออาชีพ
      จากรายละเอียดการจองด้านล่างนี้ ช่วยแนะนำรายการสินค้า/บริการที่ควรมีในใบเสนอราคา (รายละเอียด, จำนวนที่แนะนำ, และราคาต่อหน่วยเป็นบาท)
      **ตอบกลับเป็น JSON array ของวัตถุที่มีคีย์: "description", "quantity", "price" เท่านั้น**
      **รายละเอียด (description) ต้องเป็นภาษาไทย**

      รายละเอียดการจอง:
      - ประเภท: ${booking.bookingType}
      - ลูกค้า: ${booking.customer}
      - รายละเอียดเพิ่มเติม: ${booking.details}
      - วันที่/เวลา: ${booking.date} (${booking.startTime} - ${booking.endTime})
    `;

    const aiResponse = await ollamaService.callAI(prompt, "คุณเป็นผู้จัดการสตูดิโอ ตอบเป็น JSON ภาษาไทย");
    const suggestions = parseAIJson(aiResponse);
    res.json({ suggestions });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/ai/draft-email
 * Drafts an email for a quote or invoice
 */
router.post('/draft-email', async (req, res) => {
  try {
    const { type, docId } = req.body; // type: 'quote' | 'invoice'
    let doc;
    if (type === 'quote') doc = await Quote.findById(docId);
    else doc = await require('../models/Invoice').findById(docId);

    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const prompt = `
      คุณคือผู้ช่วยมืออาชีพของสตูดิโอ เขียนอีเมลหรือข้อความที่เป็นทางการและสุภาพถึงคุณ ${doc.customerName} สำหรับ ${type === 'quote' ? 'ใบเสนอราคา' : 'ใบแจ้งหนี้'} นี้:
      - เลขที่: ${type === 'quote' ? doc.quoteNumber : doc.invoiceNumber}
      - ยอดรวม: ${doc.grandTotal || doc.total} บาท
      - รายการ: ${doc.items.map(i => i.description).join(', ')}
      
      **ต้องเขียนเป็นภาษาไทยเท่านั้น** สุภาพ มีหางเสียง และเป็นกันเอง
    `;

    const draft = await ollamaService.callAI(prompt, "คุณเป็นเลขาสตูดิโอ ตอบเป็นภาษาไทยสุภาพ");
    res.json({ draft });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/ai/shot-list
 * Suggests a photography shot list and creative direction
 */
router.post('/shot-list', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const prompt = `
      คุณคือ Creative Director ของสตูดิโอถ่ายภาพระดับไฮเอนด์
      วิเคราะห์การจองนี้และแนะนำ Shot List, การจัดแสง, และอุปกรณ์ที่แนะนำ
      
      รายละเอียดการจอง:
      - ประเภท: ${booking.bookingType}
      - รายละเอียดเพิ่มเติม: ${booking.details}
      
      **ต้องตอบเป็นภาษาไทยเท่านั้น** แบ่งหัวข้อให้ชัดเจน: "Shot List (รายการภาพ)", "Lighting Setup (การจัดแสง)", และ "Equipment Recommendations (อุปกรณ์ที่แนะนำ)"
    `;

    const creativeDirection = await ollamaService.callAI(prompt, "คุณเป็น Creative Director ตอบเป็นภาษาไทย");
    res.json({ creativeDirection });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/ai/suggest-equipment
 * Suggests photography equipment based on booking details
 */
router.post('/suggest-equipment', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const prompt = `
      คุณคือผู้เชี่ยวชาญด้านอุปกรณ์ถ่ายภาพ
      วิเคราะห์รายละเอียดการจองนี้และแนะนำรายการอุปกรณ์ (กล้อง, เลนส์, ไฟ, อุปกรณ์เสริม)
      
      รายละเอียดการจอง:
      - ประเภท: ${booking.bookingType}
      - รายละเอียดเพิ่มเติม: ${booking.details}
      - ลูกค้า: ${booking.customer}
      
      **ต้องตอบเป็นภาษาไทยเท่านั้น** พร้อมอธิบายสั้นๆ ว่าทำไมถึงแนะนำอุปกรณ์ชิ้นนั้น
    `;

    const equipmentList = await ollamaService.callAI(prompt, "คุณเป็นผู้เชี่ยวชาญด้านอุปกรณ์ ตอบเป็นภาษาไทย");
    res.json({ equipmentList });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
