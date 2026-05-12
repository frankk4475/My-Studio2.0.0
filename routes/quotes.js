const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

// utils
const toAmount = (v, minZero = true) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return minZero ? Math.max(0, n) : n;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const safeItems = (items = []) =>
  (Array.isArray(items) ? items : []).map(it => ({
    description: String(it.description || '').trim(),
    quantity: toAmount(it.quantity),
    price: toAmount(it.price)
  })).filter(it => it.description);

function computeTotals({ items = [], discount = 0, vatRate = 0, includeVat = false }) {
  const subtotalRaw = items.reduce((s, it) => s + it.quantity * it.price, 0);
  const subtotal = round2(subtotalRaw);
  const disc = round2(toAmount(discount, false));
  const baseBeforeVat = Math.max(0, subtotal - Math.max(0, disc));

  const rate = toAmount(vatRate, false) / 100;
  let base = baseBeforeVat, vat = 0, grand = 0;

  if (includeVat) {
    base = rate > 0 ? round2(baseBeforeVat / (1 + rate)) : baseBeforeVat;
    vat = round2(baseBeforeVat - base);
    grand = baseBeforeVat;
  } else {
    vat = round2(baseBeforeVat * rate);
    grand = round2(baseBeforeVat + vat);
  }
  return { subtotal, discount: Math.max(0, disc), vatRate: round2(rate * 100), vat, grandTotal: grand };
}

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 }).lean();
    res.json({ data: quotes });
  } catch (e) {
    res.status(500).json({ message: 'Error fetching quotes.' });
  }
});

// POST /api/quotes
router.post('/', async (req, res) => {
  try {
    const { bookingId, items = [], discount: rawDisc = 0, customerName, contactName, customerAddress, customerTaxId, vatRate, includeVat } = req.body || {};
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found for this quote.' });

    const itemsSafe = safeItems(items);
    const totals = computeTotals({ items: itemsSafe, discount: rawDisc, vatRate, includeVat });

    const qn = `Q-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const quote = new Quote({
      bookingId,
      quoteNumber: qn,
      customerName: customerName || booking.customer,
      contactName,
      customerAddress,
      customerTaxId,
      items: itemsSafe,
      total: totals.subtotal,
      discount: totals.discount,
      vatRate: totals.vatRate,
      vat: totals.vat,
      grandTotal: totals.grandTotal,
      includeVat: !!includeVat
    });

    await quote.save();
    res.status(201).json(quote);
  } catch (e) {
    console.error('Error creating quote:', e);
    res.status(400).json({ message: 'Error creating quote.' });
  }
});

// GET /api/quotes/:id
router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found.' });
    res.json(quote);
  } catch (e) {
    res.status(500).json({ message: 'Error fetching quote.' });
  }
});

// PUT /api/quotes/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, items, discount, vatRate, includeVat, customerName, contactName, customerTaxId, customerAddress } = req.body || {};
    const q = await Quote.findById(req.params.id);
    if (!q) return res.status(404).json({ message: 'Quote not found' });

    if (items) q.items = safeItems(items);
    if (discount !== undefined) q.discount = toAmount(discount);
    if (vatRate !== undefined) q.vatRate = toAmount(vatRate);
    if (includeVat !== undefined) q.includeVat = !!includeVat;
    if (status) q.status = status;

    if (customerName !== undefined) q.customerName = customerName;
    if (contactName !== undefined) q.contactName = contactName;
    if (customerTaxId !== undefined) q.customerTaxId = customerTaxId;
    if (customerAddress !== undefined) q.customerAddress = customerAddress;

    const totals = computeTotals({
      items: q.items,
      discount: q.discount,
      vatRate: q.vatRate,
      includeVat: q.includeVat
    });

    q.total = totals.subtotal;
    q.vat = totals.vat;
    q.grandTotal = totals.grandTotal;

    let createdInvoiceId = null;
    if (q.status === 'Accepted' && !q.convertedToInvoiceId) {
      await Booking.findByIdAndUpdate(q.bookingId, { status: 'Confirmed' });

      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Default 30 days

      const inv = new Invoice({
        quoteId: q._id,
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        refQuoteId: q._id,
        refQuoteNumber: q.quoteNumber,
        customerName: q.customerName,
        customerTaxId: q.customerTaxId,
        customerAddress: q.customerAddress,
        contactName: q.contactName,
        items: q.items,
        total: q.total,
        discount: q.discount,
        vat: q.vat,
        grandTotal: q.grandTotal,
        issueDate,
        dueDate,
        paymentStatus: 'Unpaid'
      });

      await inv.save();
      q.convertedToInvoiceId = inv._id;
      createdInvoiceId = inv._id;
    }

    await q.save();
    res.json({ quote: q, createdInvoiceId });
  } catch (err) {
    console.error('Error updating quote:', err);
    res.status(400).json({ message: 'Error updating quote' });
  }
});

// DELETE /api/quotes/:id
router.delete('/:id', async (req, res) => {
  try {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found.' });
    res.json({ message: 'Quote deleted successfully.' });
  } catch (e) {
    res.status(500).json({ message: 'Error deleting quote.' });
  }
});

module.exports = router;
