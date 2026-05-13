// routes/settings.js
const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// helper: ensure one singleton doc exists
async function getSingleton() {
  let s = await Settings.findOne();
  if (!s) {
    s = await new Settings({
      business: { name: '', address: '', phone: '', email: '', taxId: '', logoUrl: '' },
      doc: { creditTermDays: 30, footerNote: '' },
      tax: { useVat: false, vatRate: 7, pricesIncludeVat: false },
      apiKeys: { lineCustomerAccessToken: '', lineCustomerSecret: '', lineAdminAccessToken: '', lineAdminSecret: '', geminiApiKey: '' }
    }).save();
  }
  return s;
}

// GET /api/settings/public (Public access)
router.get('/public', async (req, res) => {
  try {
    const s = await getSingleton();
    res.json({
        business: s.business,
        tax: s.tax
    });
  } catch (e) {
    res.status(500).json({ message: 'Error.' });
  }
});

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const s = await getSingleton();
    res.json(s);
  } catch (e) {
    console.error('GET /api/settings error:', e);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const current = await getSingleton();
    const incoming = req.body || {};

    const update = {
      business: {
        name:   incoming.business?.name    ?? current.business?.name ?? '',
        address:incoming.business?.address ?? current.business?.address ?? '',
        phone:  incoming.business?.phone   ?? current.business?.phone ?? '',
        email:  incoming.business?.email   ?? current.business?.email ?? '',
        taxId:  incoming.business?.taxId   ?? current.business?.taxId ?? '',
        logoUrl:incoming.business?.logoUrl ?? current.business?.logoUrl ?? '',
      },
      doc: {
        creditTermDays: Number(incoming.doc?.creditTermDays ?? current.doc?.creditTermDays ?? 30),
        footerNote:     incoming.doc?.footerNote ?? current.doc?.footerNote ?? '',
      },
      tax: {
        useVat:            !!(incoming.tax?.useVat ?? current.tax?.useVat),
        vatRate:           Number(incoming.tax?.vatRate ?? current.tax?.vatRate ?? 7),
        pricesIncludeVat:  !!(incoming.tax?.pricesIncludeVat ?? current.tax?.pricesIncludeVat),
      },
      apiKeys: {
        lineCustomerAccessToken: incoming.apiKeys?.lineCustomerAccessToken ?? current.apiKeys?.lineCustomerAccessToken ?? '',
        lineCustomerSecret:      incoming.apiKeys?.lineCustomerSecret      ?? current.apiKeys?.lineCustomerSecret ?? '',
        lineAdminAccessToken:    incoming.apiKeys?.lineAdminAccessToken    ?? current.apiKeys?.lineAdminAccessToken ?? '',
        lineAdminSecret:         incoming.apiKeys?.lineAdminSecret         ?? current.apiKeys?.lineAdminSecret ?? '',
        ollamaUrl:               incoming.apiKeys?.ollamaUrl               ?? current.apiKeys?.ollamaUrl ?? 'http://localhost:11434',
        ollamaModel:             incoming.apiKeys?.ollamaModel             ?? current.apiKeys?.ollamaModel ?? 'llama3'
        }
        };

        const saved = await Settings.findByIdAndUpdate(current._id, update, { new: true });
        console.log('✅ Settings saved successfully');

        // Refresh services if possible
        try {
        require('../services/lineService').refreshConfig();
        require('../services/ollamaService').refreshConfig?.();
        } catch (refreshErr) {      console.warn('⚠️ Services not refreshed yet:', refreshErr.message);
    }

    res.json(saved);
  } catch (e) {
    console.error('PUT /api/settings error:', e);
    res.status(400).json({ message: 'Error updating settings', details: e.message });
  }
});

module.exports = router;
