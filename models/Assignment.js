const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  documentNumber: { type: String, unique: true, sparse: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  equipmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' }],
  taskDescription: String,
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], 
    default: 'Pending' 
  },
  assignedAt: { type: Date, default: Date.now },
  expectedReturnDate: Date,
  completedAt: Date
}, { timestamps: true });

module.exports = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
