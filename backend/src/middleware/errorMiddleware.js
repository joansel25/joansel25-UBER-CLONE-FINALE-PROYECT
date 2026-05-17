/**
 * Global error interceptor.
 * Normalizes different error types (Mongoose, Zod, Custom) into a consistent JSON response.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log full stack for dev tracing
  console.error(`[Error Trace]: ${err.stack}`);

  // MongoDB ObjectId cast errors
  if (err.name === 'CastError') {
    const message = `Resource not found. Invalid ID: ${err.value}`;
    return res.status(404).json({ success: false, error: message });
  }

  // Duplicate key entries
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    return res.status(400).json({ success: false, error: message });
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, error: message });
  }

  // Zod request validation
  if (err.name === 'ZodError') {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json({ success: false, error: message });
  }

  // Generic fallback
  res.status(err.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
