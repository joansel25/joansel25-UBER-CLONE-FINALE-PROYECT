const Stripe = require('stripe');
const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const { User } = require('../models/User');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FARE_COP = 50000;

class PaymentService {

  /**
   * Gets the Stripe Customer ID for a user, creating one if it doesn't exist.
   * Persists stripeCustomerId back to MongoDB for future calls.
   */
  async getOrCreateStripeCustomer(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: { userId: userId.toString() },
    });

    await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
    return customer.id;
  }

  /**
   * Creates a Stripe SetupIntent so the frontend can tokenize a card
   * without charging it. The saved card can then be used in future payments.
   */
  async createSetupIntent(userId) {
    const customerId = await this.getOrCreateStripeCustomer(userId);
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return {
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
    };
  }

  /**
   * Lists all saved cards for a user.
   * Returns only safe card metadata (no raw numbers).
   */
  async listCards(userId) {
    const user = await User.findById(userId);
    if (!user?.stripeCustomerId) return [];

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    }));
  }

  /**
   * Detaches (removes) a saved card from the user's Stripe Customer.
   * Verifies ownership before detaching.
   */
  async deleteCard(userId, paymentMethodId) {
    const user = await User.findById(userId);
    if (!user?.stripeCustomerId) {
      const err = new Error('No cards on file for this user');
      err.statusCode = 404;
      throw err;
    }

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== user.stripeCustomerId) {
      const err = new Error('Card does not belong to this user');
      err.statusCode = 403;
      throw err;
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return { deleted: true, paymentMethodId };
  }

  /**
   * Creates a Stripe PaymentIntent for a completed trip.
   * Enforces 50,000 COP maximum fare.
   * Optionally attaches a saved card — frontend confirms with the clientSecret.
   * Persists a pending Transaction in MongoDB.
   */
  async createPaymentIntent(tripId, passengerId, paymentMethodId = null) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (trip.passenger.toString() !== passengerId.toString()) {
      const err = new Error('Not authorized to pay for this trip');
      err.statusCode = 403;
      throw err;
    }
    if (trip.status !== 'completed') {
      const err = new Error('Payment is only allowed for completed trips');
      err.statusCode = 409;
      throw err;
    }
    if (trip.fare > MAX_FARE_COP) {
      const err = new Error(`Fare exceeds the maximum of ${MAX_FARE_COP.toLocaleString('es-CO')} COP`);
      err.statusCode = 400;
      throw err;
    }

    const alreadyPaid = await Transaction.findOne({ trip: tripId, status: 'completed' });
    if (alreadyPaid) {
      const err = new Error('This trip has already been paid');
      err.statusCode = 409;
      throw err;
    }

    const intentParams = {
      amount: Math.round(trip.fare * 100),
      currency: 'cop',
      metadata: {
        tripId: trip._id.toString(),
        passengerId: passengerId.toString(),
      },
    };

    // Attach saved card if provided so frontend can confirm without re-entering card details
    if (paymentMethodId) {
      intentParams.payment_method = paymentMethodId;
    }

    // Link to Stripe Customer for card saving support
    const customerId = await this.getOrCreateStripeCustomer(passengerId).catch(() => null);
    if (customerId) intentParams.customer = customerId;

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    await Transaction.create({
      trip: trip._id,
      passenger: passengerId,
      amount: trip.fare,
      currency: 'COP',
      status: 'pending',
      paymentId: paymentIntent.id,
      paymentMethod: trip.paymentMethod || 'card',
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: trip.fare,
      currency: 'COP',
    };
  }

  /**
   * Processes a Stripe webhook event.
   * Verifies signature, then updates Transaction status accordingly.
   */
  async handleWebhook(rawBody, signature) {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const error = new Error(`Webhook signature verification failed: ${err.message}`);
      error.statusCode = 400;
      throw error;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await Transaction.findOneAndUpdate(
          { paymentId: pi.id },
          { status: 'completed' }
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await Transaction.findOneAndUpdate(
          { paymentId: pi.id },
          { status: 'failed' }
        );
        break;
      }
    }

    return { received: true, type: event.type };
  }

  /**
   * Returns all transactions for a user, newest first.
   */
  async getUserTransactions(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find({ passenger: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('trip', 'origin destination fare vehicleCategory status'),
      Transaction.countDocuments({ passenger: userId }),
    ]);
    return { transactions, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Returns the Transaction record for a given trip.
   */
  async getTransactionByTrip(tripId) {
    const tx = await Transaction.findOne({ trip: tripId })
      .populate('passenger', 'fullName email');
    if (!tx) {
      const err = new Error('No transaction found for this trip');
      err.statusCode = 404;
      throw err;
    }
    return tx;
  }

  /**
   * Issues a Stripe refund and marks the Transaction as refunded.
   */
  async refundPayment(tripId, passengerId) {
    const tx = await Transaction.findOne({ trip: tripId, status: 'completed' });
    if (!tx) {
      const err = new Error('No completed transaction found for this trip');
      err.statusCode = 404;
      throw err;
    }
    if (tx.passenger.toString() !== passengerId.toString()) {
      const err = new Error('Not authorized to refund this transaction');
      err.statusCode = 403;
      throw err;
    }

    const refund = await stripe.refunds.create({ payment_intent: tx.paymentId });
    await Transaction.findByIdAndUpdate(tx._id, { status: 'refunded' });

    return { refundId: refund.id, status: 'refunded', amount: tx.amount };
  }
}

module.exports = new PaymentService();
