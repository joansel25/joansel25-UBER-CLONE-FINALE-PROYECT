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
   * POST /api/drivers/register (protected)
   * Registers the authenticated user as a driver.
   * userId is resolved from the Firebase token — not accepted from the body.
   */
  async register(req, res, next) {
    try {
      const bodySchema = z.object({
        vehicleInfo: z.object({
          make:  z.string().min(1),
          model: z.string().min(1),
          year:  z.number().int().min(1990).max(new Date().getFullYear() + 1),
          color: z.string().min(1),
          plate: z.string().min(1),
        }),
        licenseNumber: z.string().min(3),
      });

      const { vehicleInfo, licenseNumber } = bodySchema.parse(req.body);

      const user = await User.findOne({ firebaseUid: req.user.uid });
      if (!user) {
        const err = new Error('User not found. Complete registration first.');
        err.statusCode = 404;
        throw err;
      }

      const driver = await driverService.registerDriver(user._id, vehicleInfo, licenseNumber);

      res.status(201).json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/drivers/status (protected)
   * Updates the availability status of the authenticated driver.
   */
  async updateStatus(req, res, next) {
    try {
      const statusSchema = z.object({
        status: z.enum(['available', 'busy', 'offline']),
      });
      const { status } = statusSchema.parse(req.body);

      const user   = await User.findOne({ firebaseUid: req.user.uid });
      if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }
      const driver = await driverService.getDriverByUserId(user._id);

      const updatedDriver = await driverService.updateStatus(driver._id, status);
      res.status(200).json({ success: true, data: updatedDriver });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/drivers/location (protected)
   * Updates the current GPS location of the authenticated driver.
   */
  async updateLocation(req, res, next) {
    try {
      const locationSchema = z.object({
        longitude: z.number().min(-180).max(180),
        latitude:  z.number().min(-90).max(90),
        tripId:    z.string().optional(),
      });
      const { longitude, latitude, tripId } = locationSchema.parse(req.body);

      const user = await User.findOne({ firebaseUid: req.user.uid });
      if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }
      const driver = await driverService.getDriverByUserId(user._id);

      const [updatedDriver] = await Promise.all([
        driverService.updateLocation(driver._id, longitude, latitude),
        trackingService.updateDriverLocation(driver._id.toString(), latitude, longitude, tripId),
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
