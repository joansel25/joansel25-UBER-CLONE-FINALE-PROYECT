const { admin } = require('../config/firebase');


const protect = async (req, res, next) => {
  let token;


  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {

      token = req.headers.authorization.split(' ')[1];


      const decodedToken = await admin.auth().verifyIdToken(token);

      req.user = decodedToken;

      next();
    } catch (error) {
      console.error('❌ Error de autenticación:', error.message);
      return res.status(401).json({
        success: false,
        message: 'No autorizado, el carnet (Token) es inválido o expiró'
      });
    }
  }


  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado, no se proporcionó ningún(Token)'
    });
  }
};

module.exports = { protect };
