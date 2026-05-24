const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect } = require('../middleware/auth');


router.get('/nearby',      protect, driverController.getNearbyDrivers);
router.get('/me',          protect, driverController.getMe);          // must be before /:id
router.get('/:id',         protect, driverController.getById);
router.post('/register',   protect, driverController.register);
router.patch('/status',    protect, driverController.updateStatus);
router.patch('/location',  protect, driverController.updateLocation);

module.exports = router;
