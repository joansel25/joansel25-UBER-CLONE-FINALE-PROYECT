import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { getTripEstimate } from '../services/mapsService';

const tripsCol   = () => firestore().collection('trips');
const usersCol   = () => firestore().collection('users');
const driversCol = () => firestore().collection('drivers');

// Timestamps de Firestore → ISO string para que las screens los traten igual
function convertTs(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate().toISOString();
  return ts;
}

function docToTrip(doc) {
  if (!doc.exists) return null;
  const d = doc.data();
  return {
    _id:          doc.id,
    id:           doc.id,
    ...d,
    createdAt:    convertTs(d.createdAt),
    acceptedAt:   convertTs(d.acceptedAt),
    startedAt:    convertTs(d.startedAt),
    completedAt:  convertTs(d.completedAt),
  };
}

const tripApi = {
  // ── Estimar tarifa + ruta ─────────────────────────────────────────────────
  estimate: async ({ originLat, originLng, destLat, destLng }) => {
    const { route, fares } = await getTripEstimate(originLat, originLng, destLat, destLng);
    return {
      data: {
        route: {
          distanceText:    route.distanceText,
          durationText:    route.durationText,
          distanceMeters:  route.distanceMeters,
          durationSeconds: route.durationSeconds,
          polyline:        route.polyline,
        },
        fares,
      },
    };
  },

  // ── Crear viaje ───────────────────────────────────────────────────────────
  create: async ({ origin, destination, vehicleCategory, paymentMethod }) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw Object.assign(new Error('No autenticado'), { statusCode: 401 });

    const userDoc  = await usersCol().doc(uid).get();
    const userData = userDoc.data() ?? {};

    const { route, fares } = await getTripEstimate(
      origin.lat, origin.lng, destination.lat, destination.lng,
    );
    const fareData = fares[vehicleCategory] ?? fares.economy;

    const tripData = {
      passengerId:  uid,
      driverId:     null,
      participants: [uid],        // para consultas de historial
      passenger: {
        _id:        uid,
        fullName:   userData.fullName   ?? '',
        profilePic: userData.profilePic ?? '',
        rating:     userData.rating     ?? 5.0,
        phone:      userData.phone      ?? '',
      },
      driver: null,
      origin: {
        address: origin.address,
        lat:     origin.lat,
        lng:     origin.lng,
      },
      destination: {
        address: destination.address,
        lat:     destination.lat,
        lng:     destination.lng,
      },
      status:          'requested',
      fare:            fareData.fare,
      distance:        route.distanceMeters / 1000,
      duration:        Math.round(route.durationSeconds / 60),
      vehicleCategory,
      paymentMethod:   paymentMethod || 'cash',
      polyline:        route.polyline,
      acceptedAt:      null,
      startedAt:       null,
      completedAt:     null,
      passengerRatingDriver:  null,
      driverRatingPassenger:  null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const ref = await tripsCol().add(tripData);
    const doc = await ref.get();
    return { data: { trip: docToTrip(doc) } };
  },

  // ── Trip history (passenger or driver) ────────────────────────────────────
  // orderBy removed: array-contains + orderBy requires a Firestore composite index.
  // Sort is done client-side to avoid needing manual index creation.
  getHistory: async ({ page = 1, limit = 10 } = {}) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return { trips: [], total: 0, page: 1, pages: 0 };

    const snap = await tripsCol()
      .where('participants', 'array-contains', uid)
      .get();

    const all = snap.docs
      .map(docToTrip)
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    const total = all.length;
    const start = (page - 1) * limit;

    return {
      trips: all.slice(start, start + limit),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  },

  // ── Available trips (status 'requested') ─────────────────────────────────
  getAvailable: async ({ page = 1, limit = 10 } = {}) => {
    const snap = await tripsCol()
      .where('status', '==', 'requested')
      .orderBy('createdAt', 'desc')
      .get();

    const all   = snap.docs.map(docToTrip);
    const total = all.length;
    const start = (page - 1) * limit;

    return {
      trips: all.slice(start, start + limit),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  },

  // ── Obtener viaje por ID ──────────────────────────────────────────────────
  getById: async (id) => {
    const doc = await tripsCol().doc(id).get();
    if (!doc.exists) throw Object.assign(new Error('Trip not found'), { statusCode: 404 });
    return { data: docToTrip(doc) };
  },

  // ── Conductor acepta viaje ────────────────────────────────────────────────
  accept: async (id) => {
    const uid      = getAuth().currentUser?.uid;
    const userDoc  = await usersCol().doc(uid).get();
    const userData = userDoc.data() ?? {};

    await tripsCol().doc(id).update({
      driverId:     uid,
      driver: {
        _id:        uid,
        fullName:   userData.fullName   ?? '',
        profilePic: userData.profilePic ?? '',
        rating:     userData.rating     ?? 5.0,
        phone:      userData.phone      ?? '',
      },
      participants: firestore.FieldValue.arrayUnion(uid),
      status:       'accepted',
      acceptedAt:   firestore.FieldValue.serverTimestamp(),
    });

    const doc = await tripsCol().doc(id).get();
    return { data: docToTrip(doc) };
  },

  // ── Conductor inicia viaje ────────────────────────────────────────────────
  start: async (id) => {
    await tripsCol().doc(id).update({
      status:    'ongoing',
      startedAt: firestore.FieldValue.serverTimestamp(),
    });
    const doc = await tripsCol().doc(id).get();
    return { data: docToTrip(doc) };
  },

  // ── Conductor completa viaje ──────────────────────────────────────────────
  complete: async (id) => {
    await tripsCol().doc(id).update({
      status:      'completed',
      completedAt: firestore.FieldValue.serverTimestamp(),
    });
    const doc = await tripsCol().doc(id).get();
    return { data: docToTrip(doc) };
  },

  // ── Cancelar viaje ────────────────────────────────────────────────────────
  cancel: async (id) => {
    await tripsCol().doc(id).update({ status: 'cancelled' });
    const doc = await tripsCol().doc(id).get();
    return { data: docToTrip(doc) };
  },

  // ── Calificar viaje (dynamic moving average via Firestore transaction) ──────
  rate: async (id, rating, feedback) => {
    const uid     = getAuth().currentUser?.uid;
    const tripDoc = await tripsCol().doc(id).get();
    if (!tripDoc.exists) throw Object.assign(new Error('Trip not found'), { statusCode: 404 });

    const trip        = tripDoc.data();
    const isPassenger = trip.passengerId === uid;

    if (isPassenger) {
      const tripUpdate = { passengerRatingDriver: rating };
      if (feedback) tripUpdate.passengerFeedback = feedback;
      await tripsCol().doc(id).update(tripUpdate);

      if (trip.driverId) {
        // Update driver rating atomically using stored ratingCount + rating
        await firestore().runTransaction(async tx => {
          const driverRef = driversCol().doc(trip.driverId);
          const userRef   = usersCol().doc(trip.driverId);
          const driverDoc = await tx.get(driverRef);
          const data      = driverDoc.exists ? driverDoc.data() : {};
          const count     = (data.ratingCount ?? 0) + 1;
          const newAvg    = +((((data.rating ?? 5.0) * (count - 1)) + rating) / count).toFixed(1);
          tx.update(driverRef, { rating: newAvg, ratingCount: count });
          if (driverDoc.exists) tx.update(userRef, { rating: newAvg });
        });
      }
    } else {
      await tripsCol().doc(id).update({ driverRatingPassenger: rating });

      await firestore().runTransaction(async tx => {
        const userRef   = usersCol().doc(trip.passengerId);
        const userDoc   = await tx.get(userRef);
        const data      = userDoc.exists ? userDoc.data() : {};
        const count     = (data.ratingCount ?? 0) + 1;
        const newAvg    = +((((data.rating ?? 5.0) * (count - 1)) + rating) / count).toFixed(1);
        if (userDoc.exists) tx.update(userRef, { rating: newAvg, ratingCount: count });
      });
    }

    const updated = await tripsCol().doc(id).get();
    return { data: docToTrip(updated) };
  },
};

export default tripApi;
