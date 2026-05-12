const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  company: { type: String, trim: true },
  taxId: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  social: { type: String, trim: true }, // Facebook, IG, etc.
  address: { type: String, trim: true },
  lineUserId: { type: String, trim: true, index: true, unique: true, sparse: true },
  lineDisplayName: { type: String, trim: true },
  linePictureUrl: { type: String, trim: true },
  notes: { type: String, trim: true },
  totalBookings: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

customerSchema.index({ name: 1, phone: 1 });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
