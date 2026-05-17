const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

// In the future, these routes should be protected by authentication middleware
// e.g., router.post('/register', authMiddleware, driverController.register);

/**
 * @route   POST /api/drivers/register
 * @desc    Register an existing user as a driver
 * @access  Private (Needs Auth)
 */
router.post('/register', driverController.register);

/**
 * @route   PATCH /api/drivers/status
 * @desc    Update driver availability status
 * @access  Private (Driver only)
 */
router.patch('/status', driverController.updateStatus);

/**
 * @route   PATCH /api/drivers/location
 * @desc    Update driver geographical location
 * @access  Private (Driver only)
 */
router.patch('/location', driverController.updateLocation);

module.exports = router;
