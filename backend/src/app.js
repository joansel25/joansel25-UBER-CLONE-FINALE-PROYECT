const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use('/api/webhooks', require('./routes/webhookRoutes'));

app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(require('morgan')('dev'));
}

app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/drivers',  require('./routes/driverRoutes'));
app.use('/api/trips',    require('./routes/tripRoutes'));
app.use('/api/places',   require('./routes/placesRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

app.use(errorHandler);

module.exports = app;
