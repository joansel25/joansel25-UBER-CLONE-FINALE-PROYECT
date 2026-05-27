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

    if (!customerId) {
      return {
        data: [
          { id: 'demo_pm_001', brand: 'visa',       last4: '4242', expMonth: 12, expYear: 2027 },
          { id: 'demo_pm_002', brand: 'mastercard', last4: '5555', expMonth:  8, expYear: 2026 },
        ],
      };
    }

    const methods = await stripeService.listPaymentMethods(customerId);
    const real = (methods.data ?? []).map(pm => ({
      id:       pm.id,
      brand:    pm.card.brand,
      last4:    pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear:  pm.card.exp_year,
    }));
    return { data: real };
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

    // Record pending transaction in Firestore; return its ID so the caller
    // can mark it 'completed' once Stripe confirms the charge.
    const txRef = await txCol().add({
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
        txId:            txRef.id,
        clientSecret:    intent.client_secret,
        paymentIntentId: intent.id,
        amount:          trip.fare,
        currency:        'COP',
      },
    };
  },

  // ── Mark transaction as completed after Stripe confirms charge ────────────
  confirmPayment: async (txId) => {
    await txCol().doc(txId).update({
      status:  'completed',
      paidAt:  firestore.FieldValue.serverTimestamp(),
    });
    return { data: { success: true } };
  },

  // ── Sync all pending transactions against the real Stripe status ──────────
  // Called on PaymentHistory load. Queries Stripe for each pending record and
  // updates Firestore to 'completed' or 'failed' based on the actual charge result.
  syncPendingTransactions: async () => {
    const uid  = getAuth().currentUser?.uid;
    if (!uid) return;

    const snap = await txCol()
      .where('passengerId', '==', uid)
      .where('status', '==', 'pending')
      .get();

    if (snap.empty) return;

    const batch = firestore().batch();
    let hasUpdates = false;

    await Promise.all(snap.docs.map(async (doc) => {
      const { paymentId } = doc.data();
      if (!paymentId) return;
      try {
        const intent = await stripeService.getPaymentIntent(paymentId);
        if (intent.status === 'succeeded') {
          batch.update(doc.ref, {
            status: 'completed',
            paidAt: firestore.FieldValue.serverTimestamp(),
          });
          hasUpdates = true;
        } else if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
          batch.update(doc.ref, { status: 'failed' });
          hasUpdates = true;
        }
      } catch { /* ignore individual lookup errors */ }
    }));

    if (hasUpdates) await batch.commit();
  },

  // ── Transaction by trip ──────────────────────────────────────────────────
  getByTrip: async (tripId) => {
    const snap = await txCol().where('tripId', '==', tripId).limit(1).get();
    if (snap.empty) throw Object.assign(new Error('No transaction found'), { statusCode: 404 });
    const doc  = snap.docs[0];
    return { data: { _id: doc.id, id: doc.id, ...doc.data() } };
  },

  // ── Historial de pagos del usuario ────────────────────────────────────────
  list: async ({ page = 1, limit = 20 } = {}) => {
    const uid  = getAuth().currentUser?.uid;
    // No .orderBy() to avoid requiring a composite Firestore index; sort client-side
    const snap = await txCol()
      .where('passengerId', '==', uid)
      .get();

    let all = snap.docs.map(doc => {
      const d = doc.data();
      return {
        _id:       doc.id,
        id:        doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (all.length === 0) {
      const now = Date.now();
      all = [
        {
          _id: 'demo_tx_001', id: 'demo_tx_001', amount: 18500, status: 'completed',
          createdAt: new Date(now - 86400000).toISOString(),
          trip: { origin: { address: 'Calle 100 #15-20' }, destination: { address: 'Aeropuerto El Dorado' } },
        },
        {
          _id: 'demo_tx_002', id: 'demo_tx_002', amount: 12000, status: 'completed',
          createdAt: new Date(now - 172800000).toISOString(),
          trip: { origin: { address: 'C.C. Andino' }, destination: { address: 'Chapinero Alto' } },
        },
        {
          _id: 'demo_tx_003', id: 'demo_tx_003', amount: 25000, status: 'pending',
          createdAt: new Date(now - 259200000).toISOString(),
          trip: { origin: { address: 'Universidad Nacional' }, destination: { address: 'La Candelaria' } },
        },
      ];
    }

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
