const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const { protect } = require('../middleware/auth');

/**
 * Trip endpoints router.
 * All paths relative to /api/trips and secured by protect middleware.
 */
router.use(protect);

// Basic CRUD
router.post('/',            tripController.create);
router.get('/',             tripController.getHistory);
router.get('/estimate',     tripController.estimate);    // must be before /:id
router.get('/available',    tripController.getAvailable); // must be before /:id
router.get('/:id',          tripController.getById);

// Lifecycle transitions
router.patch('/:id/accept',   tripController.accept);
router.patch('/:id/start',    tripController.start);
router.patch('/:id/complete', tripController.complete);
router.patch('/:id/cancel',   tripController.cancel);
router.patch('/:id/rate',     tripController.rate);

module.exports = router;
