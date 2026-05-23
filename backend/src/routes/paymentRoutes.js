const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// GET  /api/payments                       — transaction history for the user
router.get('/',                    protect, paymentController.listUserTransactions);

// POST /api/payments/create-intent        — generate Stripe PaymentIntent
router.post('/create-intent',      protect, paymentController.createIntent);

// GET  /api/payments/trip/:tripId         — get transaction for a trip
router.get('/trip/:tripId',        protect, paymentController.getByTrip);

// POST /api/payments/refund               — issue a refund
router.post('/refund',             protect, paymentController.refund);

// POST /api/payments/cards/setup          — create SetupIntent to tokenize a card
router.post('/cards/setup',        protect, paymentController.setupCard);

// GET  /api/payments/cards                — list saved cards
router.get('/cards',               protect, paymentController.listCards);

// DELETE /api/payments/cards/:pmId        — remove a saved card
router.delete('/cards/:pmId',      protect, paymentController.deleteCard);

module.exports = router;
