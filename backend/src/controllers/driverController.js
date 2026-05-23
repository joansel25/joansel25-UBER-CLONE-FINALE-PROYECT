const driverService = require('../services/driverService');
const geoService = require('../services/geoService');
const trackingService = require('../services/trackingService');
const { User } = require('../models/User');
const { driverValidationSchema } = require('../models/Driver');
const { z } = require('zod');

/**
 * Handles HTTP interface for driver operations.
 */
class DriverController {
  /**
   * GET /api/drivers/me
   * Returns the Driver profile for the currently authenticated user.
   */
  async getMe(req, res, next) {
    try {
      const user = await User.findOne({ firebaseUid: req.user.uid });
      if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }
      const driver = await driverService.getDriverByUserId(user._id);
      res.status(200).json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Registers a user as a driver.
   */
  async register(req, res, next) {
    try {
      // 1. Validate incoming data
      const validatedData = driverValidationSchema.parse(req.body);

      // 2. Pass to service layer
      const driver = await driverService.registerDriver(
        validatedData.userId,
        validatedData.vehicleInfo,
        validatedData.licenseNumber
      );

      // 3. Return success response
      res.status(201).json({
        success: true,
        data: driver
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates the availability status of the driver.
   */
  async updateStatus(req, res, next) {
    try {
      //  validation schema for status update
      const statusSchema = z.object({
        driverId: z.string(),
        status: z.enum(['available', 'busy', 'offline'])
      });

      const { driverId, status } = statusSchema.parse(req.body);

      const updatedDriver = await driverService.updateStatus(driverId, status);

      res.status(200).json({
        success: true,
        data: updatedDriver
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates the current location of the driver.
   */
  async updateLocation(req, res, next) {
    try {
      const locationSchema = z.object({
        driverId:  z.string(),
        longitude: z.number().min(-180).max(180),
        latitude:  z.number().min(-90).max(90),
        tripId:    z.string().optional(),
      });

      const { driverId, longitude, latitude, tripId } = locationSchema.parse(req.body);

      const [updatedDriver] = await Promise.all([
        driverService.updateLocation(driverId, longitude, latitude),
        trackingService.updateDriverLocation(driverId, latitude, longitude, tripId),
      ]);

      res.status(200).json({ success: true, data: updatedDriver });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/drivers/:id
   * Returns a driver profile with vehicle info and populated user data.
   */
  async getById(req, res, next) {
    try {
      const driver = await driverService.getDriverById(req.params.id);
      res.status(200).json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves available drivers close to a geographical point.
   */
  async getNearbyDrivers(req, res, next) {
    try {
      // 1. Validate query parameters (coercing strings to numbers)
      const nearbySchema = z.object({
        longitude: z.coerce.number().min(-180).max(180),
        latitude: z.coerce.number().min(-90).max(90),
        maxDistance: z.coerce.number().positive().optional(),
        limit: z.coerce.number().int().positive().optional()
      });

      const { longitude, latitude, maxDistance, limit } = nearbySchema.parse(req.query);

      // 2. Delegate to GeoService
      const drivers = await geoService.findNearbyDrivers(longitude, latitude, {
        maxDistance,
        limit
      });

      // 3. Return results
      res.status(200).json({
        success: true,
        count: drivers.length,
        data: drivers
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DriverController();
