const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'General' }, // Camera, Lens, Lighting, etc.
  serialNumber: { type: String, unique: true, sparse: true },
  barcode: { type: String, unique: true, sparse: true },
  status: { 
    type: String, 
    enum: ['Available', 'In Use', 'Maintenance', 'Retired'], 
    default: 'Available' 
  },
  note: String
}, { timestamps: true });

module.exports = mongoose.models.Equipment || mongoose.model('Equipment', equipmentSchema);
