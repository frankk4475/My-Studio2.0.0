const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
  password: { type: String, required: true },
  displayName: { type: String, trim: true },
  role: { type: String, enum: ['Admin', 'Employee'], default: 'Employee' },
  jobTitle: { type: String, trim: true },
  lineUserId: { type: String, trim: true, index: true }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
