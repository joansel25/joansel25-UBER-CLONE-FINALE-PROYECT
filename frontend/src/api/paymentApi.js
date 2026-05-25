import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import * as stripeService from '../services/stripeService';

const usersCol = () => firestore().collection('users');
const tripsCol = () => firestore().collection('trips');
const txCol    = () => firestore().collection('transactions');

// Obtiene o crea el Stripe Customer ID y lo persiste en Firestore
async function getOrCreateCustomer() {
  const uid     = getAuth().currentUser?.uid;
  const userDoc = await usersCol().doc(uid).get();
  const data    = userDoc.data();

  if (data?.stripeCustomerId) return data.stripeCustomerId;

  const customer = await stripeService.createCustomer(
    data?.email    ?? '',
    data?.fullName ?? '',
    uid,
  );

  await usersCol().doc(uid).update({ stripeCustomerId: customer.id });
  return customer.id;
}

const paymentApi = {
  // ── SetupIntent para guardar tarjeta ─────────────────────────────────────
  setupCard: async () => {
    const customerId  = await getOrCreateCustomer();
    const setupIntent = await stripeService.createSetupIntent(customerId);
    return {
      data: {
        setupIntentId: setupIntent.id,
        clientSecret:  setupIntent.client_secret,
      },
    };
  },

  // ── Listar tarjetas guardadas ─────────────────────────────────────────────
  listCards: async () => {
    const uid         = getAuth().currentUser?.uid;
    const userDoc     = await usersCol().doc(uid).get();
    const customerId  = userDoc.data()?.stripeCustomerId;

    if (!customerId) return { data: [] };

    const methods = await stripeService.listPaymentMethods(customerId);
    return {
      data: (methods.data ?? []).map(pm => ({
        id:       pm.id,
        brand:    pm.card.brand,
        last4:    pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear:  pm.card.exp_year,
      })),
    };
  },

  // ── Eliminar tarjeta ──────────────────────────────────────────────────────
  deleteCard: async (pmId) => {
    await stripeService.detachPaymentMethod(pmId);
    return { data: { deleted: true, paymentMethodId: pmId } };
  },

  // ── Crear PaymentIntent para un viaje completado ──────────────────────────
  createIntent: async (tripId, paymentMethodId = null) => {
    const uid     = getAuth().currentUser?.uid;
    const tripDoc = await tripsCol().doc(tripId).get();

    if (!tripDoc.exists) throw Object.assign(new Error('Trip not found'), { statusCode: 404 });

    const trip       = tripDoc.data();
    const customerId = await getOrCreateCustomer();

    const intent = await stripeService.createPaymentIntent(
      trip.fare,
      customerId,
      paymentMethodId,
      tripId,
      uid,
    );

    // Registrar transacción pendiente en Firestore
    await txCol().add({
      tripId,
      passengerId:   uid,
      amount:        trip.fare,
      currency:      'COP',
      status:        'pending',
      paymentId:     intent.id,
      paymentMethod: trip.paymentMethod ?? 'card',
      createdAt:     firestore.FieldValue.serverTimestamp(),
    });

    return {
      data: {
        clientSecret:    intent.client_secret,
        paymentIntentId: intent.id,
        amount:          trip.fare,
        currency:        'COP',
      },
    };
  },

  // ── Transacción por viaje ─────────────────────────────────────────────────
  getByTrip: async (tripId) => {
    const snap = await txCol().where('tripId', '==', tripId).limit(1).get();
    if (snap.empty) throw Object.assign(new Error('No transaction found'), { statusCode: 404 });
    const doc  = snap.docs[0];
    return { data: { _id: doc.id, id: doc.id, ...doc.data() } };
  },

  // ── Historial de pagos del usuario ────────────────────────────────────────
  list: async ({ page = 1, limit = 20 } = {}) => {
    const uid  = getAuth().currentUser?.uid;
    const snap = await txCol()
      .where('passengerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const all   = snap.docs.map(doc => {
      const d = doc.data();
      return {
        _id:       doc.id,
        id:        doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
      };
    });

    const total = all.length;
    const start = (page - 1) * limit;

    return {
      transactions: all.slice(start, start + limit),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  },
};

export default paymentApi;
