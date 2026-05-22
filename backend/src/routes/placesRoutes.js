const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');
const { protect } = require('../middleware/auth');

// GET /api/places/autocomplete?input=...&lat=...&lng=...&sessionToken=...
router.get('/autocomplete', protect, placesController.autocomplete);

module.exports = router;
