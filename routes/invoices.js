const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const lim  = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

    const [rows, total] = await Promise.all([
      Invoice.find().populate('quoteId', '_id').sort({ issueDate: -1 }).skip(skip).limit(lim),
      Invoice.countDocuments()
    ]);
    res.json({ data: rows, total, page: Number(page), limit: lim });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Error fetching invoices.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(invoice);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Error fetching invoice.' }); }
});

// GET /api/invoices/:id/public (Public access)
router.get('/:id/public', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(invoice);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Error fetching public invoice.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

    // Business rule: Forbidden to edit if already Paid, 
    // but allow updating paymentStatus (to move it back to Unpaid if needed)
    if (invoice.paymentStatus === 'Paid' && req.body.paymentStatus !== 'Unpaid' && Object.keys(req.body).some(k => k !== 'paymentStatus')) {
      return res.status(400).json({ message: 'Cannot edit an invoice that is already paid.' });
    }

    // Apply updates
    Object.assign(invoice, req.body);
    await invoice.save();
    
    res.json(invoice);
  } catch (e) { 
    console.error(e);
    res.status(400).json({ message: 'Error updating invoice.' }); 
  }
});

/**
 * POST /api/invoices/:id/payment
 * Records a payment against an invoice
 */
router.post('/:id/payment', async (req, res) => {
  try {
    const { amount } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const payAmount = Number(amount || 0);
    invoice.amountPaid += payAmount;
    
    const targetTotal = invoice.grandTotal || invoice.total;
    invoice.balance = Math.max(0, targetTotal - invoice.amountPaid);

    if (invoice.balance <= 0) {
      invoice.paymentStatus = 'Paid';
    } else if (invoice.amountPaid > 0) {
      invoice.paymentStatus = 'Partial';
    }

    await invoice.save();
    res.json(invoice);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: 'Error recording payment' });
  }
});

module.exports = router;
