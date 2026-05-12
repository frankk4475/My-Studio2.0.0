const express = require('express');
const router = express.Router();
const { callGemini } = require('../services/geminiService');
const Booking = require('../models/Booking');
const Quote = require('../models/Quote');

// Helper to clean JSON response from Gemini
const parseGeminiJson = (text) => {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Gemini JSON:', e, text);
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
      You are an expert photography studio manager. 
      Based on the following booking details, suggest a list of quote items (description, estimated quantity, and unit price in THB).
      Return ONLY a JSON array of objects with keys: "description", "quantity", "price".
      
      Booking Details:
      - Type: ${booking.bookingType}
      - Customer: ${booking.customer}
      - Details: ${booking.details}
      - Date/Time: ${booking.date} (${booking.startTime} - ${booking.endTime})
    `;

    const aiResponse = await callGemini(prompt);
    const suggestions = parseGeminiJson(aiResponse);
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
      You are a professional studio assistant. Write a polite and professional email to ${doc.customerName} for the following ${type}:
      - Number: ${type === 'quote' ? doc.quoteNumber : doc.invoiceNumber}
      - Total Amount: ${doc.grandTotal || doc.total} THB
      - Items: ${doc.items.map(i => i.description).join(', ')}
      
      The email should be professional, concise, and encourage the client to reach out with questions.
    `;

    const draft = await callGemini(prompt);
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
      You are a creative director for a high-end photography studio.
      Analyze this booking and suggest a comprehensive shot list, lighting setup, and equipment recommendations.
      
      Booking Details:
      - Type: ${booking.bookingType}
      - Details: ${booking.details}
      
      Return the response in a structured format with sections: "Shot List", "Lighting Setup", and "Equipment Recommendations".
    `;

    const creativeDirection = await callGemini(prompt);
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
      You are a specialized photography equipment expert.
      Analyze the following booking details and suggest a tailored list of equipment (cameras, lenses, lighting, accessories).
      
      Booking Details:
      - Type: ${booking.bookingType}
      - Details: ${booking.details}
      - Customer: ${booking.customer}
      
      Return a structured list with brief explanations for why each piece is recommended.
    `;

    const equipmentList = await callGemini(prompt);
    res.json({ equipmentList });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
