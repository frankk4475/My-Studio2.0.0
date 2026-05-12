require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studioDB';

async function resetDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    const collections = [
      'invoices',
      'quotes',
      'bookings',
      'assignments',
      'equipment',
      // 'users', // We might want to keep users or clear them too. 
      // The user said "เหมือนคืนค่าโรงงาน" (like factory reset)
      // and "ทำระบบสร้างยูสเชอร์ครั้งแรกก่อนเข้าใช้งาน" (system to create first user)
      // This implies we should probably clear users too so they can test the first-time setup.
      'users',
      'settings'
    ];

    for (const colName of collections) {
      try {
        await mongoose.connection.collection(colName).deleteMany({});
        console.log(`🗑️ Cleared collection: ${colName}`);
      } catch (err) {
        console.log(`⚠️ Collection ${colName} might not exist or error: ${err.message}`);
      }
    }

    console.log('✅ Database reset completed successfully!');
    
  } catch (err) {
    console.error('❌ Error resetting database:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

resetDatabase();
