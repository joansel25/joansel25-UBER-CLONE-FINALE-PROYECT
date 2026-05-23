const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

/**
 * User routes mapping.
 * All paths relative to /api/users
 */

// Onboarding & Profile
router.post('/register',            userController.register);
router.get('/profile',     protect, userController.getProfile);
router.patch('/profile',   protect, userController.updateProfile);

module.exports = router;
