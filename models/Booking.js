const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerType: { type: String, default: 'บุคคลทั่วไป' },
  customer:     { type: String, required: true, trim: true },
  date:         { type: Date, required: true },
  startTime:    { type: String, required: true }, // HH:mm
  endTime:      { type: String, required: true }, // HH:mm
  bookingType:  { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  details:      { type: String, trim: true },
  status:       { type: String, enum: ['Pending','Confirmed','Cancelled'], default: 'Pending' },
  lineUserId:   { type: String, trim: true, index: true }
}, { timestamps: true });

bookingSchema.index({ date: -1 });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
