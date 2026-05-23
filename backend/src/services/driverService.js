const { Driver } = require('../models/Driver');
const User = require('../models/User');

/**
 * Service to handle Driver specific business logic.
 * Adheres to Single Responsibility Principle (SRP).
 */
class DriverService {
  /*
   * Registers a new driver linked to an existing user.
   */
  async registerDriver(userId, vehicleInfo, licenseNumber) {
    // 1. Verify if user exists
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // 2. Check if user is already a driver
    const existingDriver = await Driver.findOne({ user: userId });
    if (existingDriver) {
      const error = new Error('User is already registered as a driver');
      error.statusCode = 400;
      throw error;
    }

    // 3. Create the driver profile
    const newDriver = new Driver({
      user: userId,
      vehicleInfo,
      licenseNumber,
      status: 'offline', // Default status upon registration
      currentLocation: {
        type: 'Point',
        coordinates: [0, 0]
      }
    });

    await newDriver.save();
    return newDriver;
  }

  /**
   * Returns a driver profile with populated user data.
   */
  async getDriverById(driverId) {
    const driver = await Driver.findById(driverId)
      .populate('user', 'fullName email phone profilePic rating');
    if (!driver) {
      const err = new Error('Driver not found');
      err.statusCode = 404;
      throw err;
    }
    return driver;
  }

  /**
   * Updates the availability status of a driver.
   */
  async updateStatus(driverId, status) {
    const validStatuses = ['available', 'busy', 'offline'];
    if (!validStatuses.includes(status)) {
      const error = new Error('Invalid status value');
      error.statusCode = 400;
      throw error;
    }

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedDriver) {
      const error = new Error('Driver not found');
      error.statusCode = 404;
      throw error;
    }

    return updatedDriver;
  }

  /**
   * Finds a driver profile by their MongoDB User ID.
   */
  async getDriverByUserId(userId) {
    const driver = await Driver.findOne({ user: userId })
      .populate('user', 'fullName email phone profilePic rating');
    if (!driver) {
      const err = new Error('Driver profile not found');
      err.statusCode = 404;
      throw err;
    }
    return driver;
  }

  /**
   * Updates the geospatial location of a driver.
   */
  async updateLocation(driverId, longitude, latitude) {
    // Validate coordinates to prevent MongoDB errors
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      const error = new Error('Invalid coordinates');
      error.statusCode = 400;
      throw error;
    }

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude] // GeoJSON format requires [long, lat]
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedDriver) {
      const error = new Error('Driver not found');
      error.statusCode = 404;
      throw error;
    }

    return updatedDriver;
  }
}

module.exports = new DriverService();
