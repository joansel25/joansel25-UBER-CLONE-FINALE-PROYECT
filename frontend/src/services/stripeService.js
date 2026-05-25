import Config from 'react-native-config';

const SECRET = Config.STRIPE_SECRET_KEY;
const BASE   = 'https://api.stripe.com/v1';

async function stripeRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      Authorization:  `Bearer ${SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (body && method !== 'GET') {
    options.body = Object.entries(body)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  const res  = await fetch(`${BASE}${path}`, options);
  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message ?? 'Stripe error');
    err.statusCode = res.status;
    throw err;
  }

  return data;
}

export async function createCustomer(email, name, userId) {
  return stripeRequest('POST', '/customers', {
    email,
    name,
    'metadata[userId]': userId,
  });
}

export async function createSetupIntent(customerId) {
  return stripeRequest('POST', '/setup_intents', {
    customer:                customerId,
    'payment_method_types[]': 'card',
  });
}

export async function createPaymentIntent(amountCOP, customerId, paymentMethodId, tripId, passengerId) {
  const body = {
    amount:               String(Math.round(amountCOP * 100)),
    currency:             'cop',
    customer:             customerId,
    'metadata[tripId]':       tripId,
    'metadata[passengerId]':  passengerId,
  };
  if (paymentMethodId) body.payment_method = paymentMethodId;

  return stripeRequest('POST', '/payment_intents', body);
}

export async function listPaymentMethods(customerId) {
  const query = `customer=${encodeURIComponent(customerId)}&type=card`;
  return stripeRequest('GET', `/payment_methods?${query}`);
}

export async function detachPaymentMethod(paymentMethodId) {
  return stripeRequest('POST', `/payment_methods/${paymentMethodId}/detach`);
}

export async function createRefund(paymentIntentId) {
  return stripeRequest('POST', '/refunds', { payment_intent: paymentIntentId });
}
