const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const lineService = require('../services/lineService');

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ lastActive: -1 });
    res.json(customers);
  } catch (e) {
    res.status(500).json({ message: 'Error fetching customers.' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(customer);
  } catch (e) {
    res.status(400).json({ message: 'Error updating customer.' });
  }
});

// POST /api/customers/send-message
router.post('/send-message', async (req, res) => {
  try {
    const { lineUserId, message } = req.body;
    if (!lineUserId || !message) return res.status(400).json({ message: 'Missing userId or message' });

    await lineService.client.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: message }]
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ message: 'Failed to send LINE message.' });
  }
});

module.exports = router;
