const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity:    { type: Number, default: 1, min: 0 },
  price:       { type: Number, default: 0, min: 0 }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  bookingId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  quoteNumber:      { type: String, index: { unique: true, sparse: true } },
  customerName:     { type: String, trim: true },
  contactName:      { type: String, trim: true },
  customerAddress:  { type: String, trim: true },
  customerTaxId:    { type: String, trim: true },
  items:            { type: [quoteItemSchema], default: [] },
  total:            { type: Number, default: 0, min: 0 },
  discount:         { type: Number, default: 0, min: 0 },
  vatRate:          { type: Number, default: 0 },
  vat:              { type: Number, default: 0 },
  grandTotal:       { type: Number, default: 0 },
  includeVat:       { type: Boolean, default: false },
  requiredDeposit:  { type: Number, default: 0, min: 0 },
  status:           { type: String, enum: ['Draft','Sent','Accepted','Declined'], default: 'Draft' },
  convertedToInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  createdAt:        { type: Date, default: Date.now }
});

quoteSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);
