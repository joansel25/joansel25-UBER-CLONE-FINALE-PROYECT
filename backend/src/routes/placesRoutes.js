const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');
const { protect } = require('../middleware/auth');

// GET /api/places/autocomplete?input=...&lat=...&lng=...&sessionToken=...
router.get('/autocomplete', protect, placesController.autocomplete);

// GET /api/places/details?placeId=...&sessionToken=...
router.get('/details',      protect, placesController.details);

module.exports = router;
