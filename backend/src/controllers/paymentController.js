const { z } = require('zod');
const paymentService = require('../services/paymentService');
const { User } = require('../models/User');

async function resolveUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid });
  if (!user) {
    const err = new Error('User not found. Complete registration first.');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

const createIntentSchema = z.object({
  tripId:          z.string().min(1),
  paymentMethodId: z.string().optional(),
});

const refundSchema = z.object({
  tripId: z.string().min(1),
});

const deleteCardSchema = z.object({
  paymentMethodId: z.string().min(1),
});

class PaymentController {

  /**
   * GET /api/payments
   * Returns paginated transaction history for the authenticated user.
   */
  async listUserTransactions(req, res, next) {
    try {
      const pageSchema = z.object({
        page:  z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(50).optional(),
      });
      const { page, limit } = pageSchema.parse(req.query);
      const passenger = await resolveUser(req.user.uid);
      const result = await paymentService.getUserTransactions(passenger._id, { page, limit });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/create-intent
   * Creates a Stripe PaymentIntent for a completed trip.
   * Returns clientSecret so the React Native app can confirm the payment.
   */
  async createIntent(req, res, next) {
    try {
      const { tripId, paymentMethodId } = createIntentSchema.parse(req.body);
      const passenger = await resolveUser(req.user.uid);

      const result = await paymentService.createPaymentIntent(tripId, passenger._id, paymentMethodId);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/cards/setup
   * Creates a SetupIntent so the frontend can tokenize a card without charging.
   * After confirmation, the card is saved to the user's Stripe Customer.
   */
  async setupCard(req, res, next) {
    try {
      const passenger = await resolveUser(req.user.uid);
      const result = await paymentService.createSetupIntent(passenger._id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/cards
   * Lists all saved cards for the authenticated user.
   */
  async listCards(req, res, next) {
    try {
      const passenger = await resolveUser(req.user.uid);
      const cards = await paymentService.listCards(passenger._id);
      res.status(200).json({ success: true, data: cards });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/payments/cards/:pmId
   * Removes a saved card from the user's Stripe Customer.
   */
  async deleteCard(req, res, next) {
    try {
      const passenger = await resolveUser(req.user.uid);
      const result = await paymentService.deleteCard(passenger._id, req.params.pmId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/trip/:tripId
   * Returns the Transaction record for a trip.
   */
  async getByTrip(req, res, next) {
    try {
      const tx = await paymentService.getTransactionByTrip(req.params.tripId);
      res.status(200).json({ success: true, data: tx });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/refund
   * Issues a Stripe refund and marks the Transaction as refunded.
   */
  async refund(req, res, next) {
    try {
      const { tripId } = refundSchema.parse(req.body);
      const passenger = await resolveUser(req.user.uid);

      const result = await paymentService.refundPayment(tripId, passenger._id);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/webhooks/stripe
   * Receives Stripe webhook events.
   * Must use raw body — mounted before express.json() in index.js.
   */
  async stripeWebhook(req, res, next) {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ success: false, message: 'Missing stripe-signature header' });
      }

      const result = await paymentService.handleWebhook(req.body, signature);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
