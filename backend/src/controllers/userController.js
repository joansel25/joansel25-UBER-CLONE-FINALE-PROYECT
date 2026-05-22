const userService = require('../services/userService');
const { userValidationSchema } = require('../models/User');

//Handles HTTP interface for user operations.

class UserController {
  /**
   * Registration endpoint.
   * Validates payload before calling service layer.
   */
  async register(req, res, next) {
    try {
      // Schema validation check
      const validatedData = userValidationSchema.parse(req.body);

      const user = await userService.registerUser(validatedData);

      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
 
 
  async getProfile(req, res, next) {
    try {
      const user = await userService.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User record not found' });
      }
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/profile
   * Updates mutable profile fields: fullName, phone, language, profilePic.
   */
  async updateProfile(req, res, next) {
    try {
      const user = await userService.updateProfile(req.user.uid, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
