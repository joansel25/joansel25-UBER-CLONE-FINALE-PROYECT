const admin = require('firebase-admin');
const path = require('path');


const initializeFirebase = () => {
  try {

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebase-service-account.json';

    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);


    admin.initializeApp({
      credential: admin.credential.cert(resolvedPath),
      // databaseURL: "https://<TU-PROYECTO>.firebaseio.com" // Opcional, solo si usas Realtime DB desde el Admin
    });

    console.log('✅ Firebase Admin SDK inicializado correctamente.');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin SDK:', error.message);
    console.log('⚠️ Asegúrate de que el archivo JSON de credenciales esté en la ruta especificada en el .env');
  }
};

module.exports = { admin, initializeFirebase };
