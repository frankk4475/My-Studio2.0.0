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

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (e) {
    res.status(400).json({ message: e.message || 'Error creating customer.' });
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

    console.log(`Sending LINE message to ${lineUserId}: ${message}`);

    await lineService.sendMessage(lineUserId, message);

    res.json({ ok: true });
  } catch (e) {
    console.error('Send message error details:', e);
    let errorMsg = 'Failed to send LINE message.';
    if (e.originalError && e.originalError.response) {
      console.error('LINE API Response:', e.originalError.response.data);
      errorMsg += ` LINE API Error: ${JSON.stringify(e.originalError.response.data)}`;
    }
    res.status(500).json({ message: errorMsg, details: e.message });
  }
});

module.exports = router;
