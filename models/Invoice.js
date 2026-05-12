const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity:    { type: Number, default: 1, min: 0 },
  price:       { type: Number, default: 0, min: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  quoteId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', index: true },
  invoiceNumber: { type: String, index: { unique: true, sparse: true } },
  customerName:  { type: String, trim: true },
  contactName:   { type: String, trim: true },
  customerAddress: { type: String, trim: true },
  customerTaxId: { type: String, trim: true },
  items:         { type: [quoteItemSchema], default: [] },
  total:         { type: Number, default: 0, min: 0 },
  discount:      { type: Number, default: 0, min: 0 },
  vat:           { type: Number, default: 0 },
  grandTotal:    { type: Number, default: 0 },
  issueDate:     { type: Date, default: Date.now },
  dueDate:       Date,
  paymentStatus: { type: String, enum: ['Unpaid','Partial','Paid'], default: 'Unpaid' },
  amountPaid:    { type: Number, default: 0 },
  balance:       { type: Number, default: 0 },
  refQuoteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  refQuoteNumber: String
}, { timestamps: true });

invoiceSchema.index({ issueDate: -1 });

// Ensure balance and amountPaid are consistent with paymentStatus before saving
invoiceSchema.pre('save', function(next) {
  const targetTotal = this.grandTotal || this.total;
  
  if (this.paymentStatus === 'Paid') {
    this.amountPaid = targetTotal;
    this.balance = 0;
  } else if (this.paymentStatus === 'Unpaid' && this.amountPaid === 0) {
    this.balance = targetTotal;
  } else {
    this.balance = Math.max(0, targetTotal - this.amountPaid);
    if (this.balance === 0) {
      this.paymentStatus = 'Paid';
    } else if (this.amountPaid > 0) {
      this.paymentStatus = 'Partial';
    }
  }
  next();
});

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
