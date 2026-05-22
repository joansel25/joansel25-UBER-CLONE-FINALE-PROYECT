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


  async getUserByFirebaseUid(uid) {
    return await User.findOne({ firebaseUid: uid });
  }

  /**
   * Partial update of user profile fields.
   * Only whitelisted fields can be changed — email, role, and firebaseUid are immutable.
   */
  async updateProfile(uid, updates) {
    const allowed = ['fullName', 'phone', 'language', 'profilePic'];
    const safeUpdates = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length === 0) {
      const err = new Error('No valid fields provided for update');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      safeUpdates,
      { new: true, runValidators: true }
    );
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }
}

module.exports = new UserService();
