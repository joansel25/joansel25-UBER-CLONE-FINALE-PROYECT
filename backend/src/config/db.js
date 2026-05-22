const mongoose = require('mongoose');

/**
 * DB connection handler. 
 * We wait for this to resolve before starting the server.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Kill process if DB is unreachable. No point in running without data.
    console.error(`❌ DB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
