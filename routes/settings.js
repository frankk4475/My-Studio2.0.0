// routes/settings.js
const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// helper: ensure one singleton doc exists
async function getSingleton() {
  let s = await Settings.findOne();
  if (!s) {
    s = await new Settings({}).save();
  }
  return s;
}

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

    // แค่ merge แบบหลวมๆ ป้องกัน 400 ง่าย ๆ
    const incoming = req.body || {};
    const update = {
      business: {
        name:   incoming?.business?.name    ?? current.business?.name,
        address:incoming?.business?.address ?? current.business?.address,
        phone:  incoming?.business?.phone   ?? current.business?.phone,
        email:  incoming?.business?.email   ?? current.business?.email,
        taxId:  incoming?.business?.taxId   ?? current.business?.taxId,
        logoUrl:incoming?.business?.logoUrl ?? current.business?.logoUrl,
      },
      doc: {
        creditTermDays: Number(incoming?.doc?.creditTermDays ?? current.doc?.creditTermDays ?? 30),
        footerNote:     incoming?.doc?.footerNote ?? current.doc?.footerNote,
      },
      tax: {
        useVat:            !!(incoming?.tax?.useVat ?? current.tax?.useVat),
        vatRate:           Number(incoming?.tax?.vatRate ?? current.tax?.vatRate ?? 7),
        pricesIncludeVat:  !!(incoming?.tax?.pricesIncludeVat ?? current.tax?.pricesIncludeVat),
      }
    };

    const saved = await Settings.findByIdAndUpdate(current._id, update, { new: true });
    res.json(saved);
  } catch (e) {
    console.error('PUT /api/settings error:', e);
    res.status(400).json({ message: 'Error updating settings' });
  }
});

module.exports = router;
