import firestore from '@react-native-firebase/firestore';
import database   from '@react-native-firebase/database';
import { getAuth } from '@react-native-firebase/auth';

const driversCol = () => firestore().collection('drivers');
const usersCol   = () => firestore().collection('users');

function docToDriver(doc) {
  if (!doc.exists) return null;
  const d = doc.data();
  return { _id: doc.id, id: doc.id, ...d };
}

const driverApi = {
  // ── Registrar conductor ───────────────────────────────────────────────────
  register: async (vehicleInfo, licenseNumber) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw Object.assign(new Error('No autenticado'), { statusCode: 401 });

    const existing = await driversCol().doc(uid).get();
    if (existing.exists) {
      throw Object.assign(
        new Error('User is already registered as a driver'),
        { statusCode: 400 },
      );
    }

    const driverData = {
      userId:        uid,
      vehicleInfo,
      licenseNumber,
      isVerified:    false,
      status:        'offline',
      createdAt:     firestore.FieldValue.serverTimestamp(),
    };

    await driversCol().doc(uid).set(driverData);
    // Promover rol a 'driver'
    await usersCol().doc(uid).update({ role: 'driver' });

    const doc = await driversCol().doc(uid).get();
    return { data: docToDriver(doc) };
  },

  // ── Obtener perfil del conductor autenticado ──────────────────────────────
  getMe: async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw Object.assign(new Error('No autenticado'), { statusCode: 401 });

    const doc = await driversCol().doc(uid).get();
    if (!doc.exists) throw Object.assign(new Error('Driver not found'), { statusCode: 404 });
    return { data: docToDriver(doc) };
  },

  // ── Obtener conductor por ID ──────────────────────────────────────────────
  getById: async (id) => {
    const doc = await driversCol().doc(id).get();
    if (!doc.exists) throw Object.assign(new Error('Driver not found'), { statusCode: 404 });
    return { data: docToDriver(doc) };
  },

  // ── Cambiar estado (available / busy / offline) ───────────────────────────
  updateStatus: async (status) => {
    const valid = ['available', 'busy', 'offline'];
    if (!valid.includes(status)) {
      throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
    }

    const uid = getAuth().currentUser?.uid;
    await driversCol().doc(uid).update({ status });
    const doc = await driversCol().doc(uid).get();
    return { data: docToDriver(doc) };
  },

  // ── Publish driver location to Realtime Database ─────────────────────────
  updateLocation: async (lat, lng, tripId = null) => {
    const uid     = getAuth().currentUser?.uid;
    const payload = { lat, lng, timestamp: Date.now() };
    if (tripId) payload.tripId = tripId;

    await database().ref(`/drivers/${uid}/location`).set(payload);
    return { data: payload };
  },

  // ── Conductores cercanos (disponibles) ────────────────────────────────────
  getNearby: async (_lat, _lng, _opts = {}) => {
    const snap = await driversCol().where('status', '==', 'available').get();
    return { data: snap.docs.map(docToDriver) };
  },
};

export default driverApi;
