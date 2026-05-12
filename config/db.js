const mongoose = require('mongoose');

/**
 * Database Connection Manager
 * Handles connection lifecycle, pooling, and automated retries.
 */
const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studioDB';

  const options = {
    // Note: In modern Mongoose (6+), these are defaults but kept for clarity or specific overrides
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6
  };

  try {
    const conn = await mongoose.connect(MONGO_URI, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    process.exit(1); // Exit process with failure
  }

  // Connection Event Listeners
  mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to DB Cluster');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ Mongoose connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Mongoose connection is disconnected. Attempting to reconnect...');
  });

  // Handle process termination for graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🛑 Mongoose connection closed due to app termination');
    process.exit(0);
  });
};

module.exports = connectDB;
