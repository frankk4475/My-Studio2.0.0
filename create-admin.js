require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studioDB';
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'Admin123';

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    const existingUser = await User.findOne({ username: ADMIN_USERNAME });
    if (existingUser) {
      console.log(`⚠️ User "${ADMIN_USERNAME}" already exists.`);
      process.exit(0);
    }

    console.log(`Creating user "${ADMIN_USERNAME}"...`);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    const admin = new User({
      username: ADMIN_USERNAME,
      password: hashedPassword
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    
  } catch (err) {
    console.error('❌ Error creating admin user:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

createAdmin();
