// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  business: {
    name: String,
    address: String,
    phone: String,
    email: String,
    taxId: String,
    logoUrl: String,
  },
  doc: {
    creditTermDays: { type: Number, default: 30 },
    footerNote: String,
  },
  tax: {
    useVat: { type: Boolean, default: false },
    vatRate: { type: Number, default: 7 },
    pricesIncludeVat: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
