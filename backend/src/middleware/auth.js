const { admin } = require('../config/firebase');

/**
 * Auth guard. 
 * Validates Firebase ID tokens and attaches user identity to the request.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Delegate validation to Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Inject user payload for downstream handlers
      req.user = decodedToken;
      
      return next();
    } catch (error) {
      console.error('Auth check failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  }
 
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
};

module.exports = { protect };
