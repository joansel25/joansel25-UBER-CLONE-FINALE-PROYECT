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
    return res.status(404).json({ success: false, message: `ID inválido: ${err.value}` });
  }

  // Duplicate key entries
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'campo';
    return res.status(400).json({ success: false, message: `Ya existe un registro con ese ${field}` });
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json({ success: false, message });
  }

  // Zod request validation
  if (err.name === 'ZodError') {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({ success: false, message });
  }

  // Generic fallback
  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
  });
};

module.exports = errorHandler;
