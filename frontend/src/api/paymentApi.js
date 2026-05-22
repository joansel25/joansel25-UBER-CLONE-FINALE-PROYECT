import client from './client';

const paymentApi = {
  setupCard:     ()                        => client.post('/payments/cards/setup'),
  listCards:     ()                        => client.get('/payments/cards'),
  deleteCard:    (pmId)                    => client.delete(`/payments/cards/${pmId}`),
  createIntent:  (tripId, paymentMethodId) =>
    client.post('/payments/create-intent', { tripId, paymentMethodId }),
};

export default paymentApi;
