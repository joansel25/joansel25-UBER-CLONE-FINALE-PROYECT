const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect } = require('../middleware/auth');

// In the future, these routes should be protected by authentication middleware
// e.g., router.post('/register', authMiddleware, driverController.register);


router.get('/nearby',      protect, driverController.getNearbyDrivers);
router.get('/me',          protect, driverController.getMe);          // must be before /:id
router.get('/:id',         protect, driverController.getById);
router.post('/register',   protect, driverController.register);
router.patch('/status',             driverController.updateStatus);
router.patch('/location',           driverController.updateLocation);

module.exports = router;
