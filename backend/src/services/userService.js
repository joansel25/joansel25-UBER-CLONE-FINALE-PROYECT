const { User } = require('../models/User');

/**
 * User logic layer.
 * Keeps controllers lean and simplifies testing.
 */
class UserService {
  /*
   * Syncs Firebase user with local MongoDB.
   * Updates existing records or creates new ones.
   */
  async registerUser(userData) {
    let user = await User.findOne({ firebaseUid: userData.firebaseUid });

    if (user) {
      // Refresh local data from Firebase source
      Object.assign(user, userData);
      return await user.save();
    }

    // New user persistence
    user = new User(userData);
    return await user.save();
  }


  // Fetch user by Firebase UID.

  async getUserByFirebaseUid(uid) {
    return await User.findOne({ firebaseUid: uid });
  }
}

module.exports = new UserService();
