const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// express.raw() is required here so Stripe can verify the webhook signature.
// This route MUST be mounted before express.json() in index.js.
router.post('/stripe', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);

module.exports = router;
