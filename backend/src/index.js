const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/db');
const { initializeFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Stripe webhook must receive the raw body for signature verification.
// Mount it BEFORE express.json() strips the raw bytes.
app.use(cors());
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// Base middleware stack
app.use(express.json());
app.use(morgan('dev'));

// Routing
app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/drivers',  require('./routes/driverRoutes'));
app.use('/api/trips',    require('./routes/tripRoutes'));
app.use('/api/places',   require('./routes/placesRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// 404 fallback
app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Final error handling - Must be last
app.use(errorHandler);

const startServer = async () => {
  try {
    // Core service init
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