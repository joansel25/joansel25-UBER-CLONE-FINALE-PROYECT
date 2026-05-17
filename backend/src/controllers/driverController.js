const driverService = require('../services/driverService');
const { driverValidationSchema } = require('../models/Driver');
const { z } = require('zod');

/**
 * Handles HTTP interface for driver operations.
 */
class DriverController {
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
      // Create a specific validation schema for status update
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
      // Create a specific validation schema for location update
      const locationSchema = z.object({
        driverId: z.string(),
        longitude: z.number().min(-180).max(180),
        latitude: z.number().min(-90).max(90)
      });

      const { driverId, longitude, latitude } = locationSchema.parse(req.body);

      const updatedDriver = await driverService.updateLocation(driverId, longitude, latitude);

      res.status(200).json({
        success: true,
        data: updatedDriver
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DriverController();
