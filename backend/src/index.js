const app        = require('./app');
const connectDB  = require('./config/db');
const { initializeFirebase } = require('./config/firebase');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    initializeFirebase();
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
};

startServer();
