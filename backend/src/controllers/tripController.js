const { z } = require('zod');
const { User } = require('../models/User');
const tripService = require('../services/tripService');
const mapsService = require('../services/mapsService');
const geoService  = require('../services/geoService');

// ── Zod schemas ────────────────────────────────────────────────────────────

const coordSchema = z.object({
  address: z.string().min(3),
  lat:     z.number().min(-90).max(90),
  lng:     z.number().min(-180).max(180),
});

const createTripSchema = z.object({
  origin:          coordSchema,
  destination:     coordSchema,
  vehicleCategory: z.enum(['economy', 'xl', 'premium']),
  paymentMethod:   z.enum(['card', 'cash']).optional(),
});

const acceptSchema = z.object({
  driverId: z.string().min(1),
});

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Resolves the MongoDB User document from a Firebase UID.
 * Throws 404 if the user has not been registered in MongoDB yet.
 */
async function resolveUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid });
  if (!user) {
    const err = new Error('User not found. Complete registration first.');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

// ── Controller ─────────────────────────────────────────────────────────────

class TripController {

  /**
   * POST /api/trips
   * Passenger requests a new trip.
   * Calls Google Directions API for route + fare estimate,
   * then persists the trip with 'requested' status.
   */
  async create(req, res, next) {
    try {
      // 1. Validate body
      const { origin, destination, vehicleCategory, paymentMethod } = createTripSchema.parse(req.body);

      // 2. Resolve MongoDB passenger from Firebase token
      const passenger = await resolveUser(req.user.uid);

      // 3. Get route + all fare estimates from Google Maps
      const estimate = await mapsService.getTripEstimate(
        [origin.lat,      origin.lng],
        [destination.lat, destination.lng]
      );

      // 4. Pick fare for chosen category
      const selectedFare = estimate.fares[vehicleCategory].fare;

      // 5. Check nearby driver availability (informational, does not block creation)
      const nearbyDrivers = await geoService.findNearbyDrivers(origin.lng, origin.lat, {
        maxDistance: 8000,
        limit: 10,
      });

      // 6. Persist trip
      const trip = await tripService.createTrip({
        passengerId:  passenger._id,
        origin,
        destination,
        vehicleCategory,
        paymentMethod,
        fare:         selectedFare,
        distanceKm:   +(estimate.route.distanceMeters / 1000).toFixed(2),
        durationMin:  +(estimate.route.durationSeconds / 60).toFixed(0),
        polyline:     estimate.route.polyline,
      });

      // 7. Respond with trip + full estimate so frontend can display all categories
      res.status(201).json({
        success: true,
        data: {
          trip,
          estimate: {
            route: {
              distanceText:  estimate.route.distanceText,
              durationText:  estimate.route.durationText,
              polyline:      estimate.route.polyline,
            },
            fares:          estimate.fares,
            nearbyDrivers:  nearbyDrivers.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/trips
   * Returns paginated trip history for the authenticated user.
   */
  async getHistory(req, res, next) {
    try {
      const pageSchema = z.object({
        page:  z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(50).optional(),
      });

      const { page, limit } = pageSchema.parse(req.query);
      const user = await resolveUser(req.user.uid);
      const result = await tripService.getUserTrips(user._id, { page, limit });

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/trips/:id
   * Returns a single trip with populated passenger and driver.
   */
  async getById(req, res, next) {
    try {
      const trip = await tripService.getTripById(req.params.id);
      res.status(200).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/trips/:id/accept
   * Driver accepts a requested trip.
   */
  async accept(req, res, next) {
    try {
      const { driverId } = acceptSchema.parse(req.body);
      const trip = await tripService.acceptTrip(req.params.id, driverId);
      res.status(200).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/trips/:id/start
   * Driver starts an accepted trip (passenger is picked up).
   */
  async start(req, res, next) {
    try {
      const user = await resolveUser(req.user.uid);
      const trip = await tripService.startTrip(req.params.id, user._id);
      res.status(200).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/trips/:id/complete
   * Driver marks the trip as completed (passenger dropped off).
   */
  async complete(req, res, next) {
    try {
      const user = await resolveUser(req.user.uid);
      const trip = await tripService.completeTrip(req.params.id, user._id);
      res.status(200).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/trips/:id/cancel
   * Passenger or driver cancels a trip (only while requested or accepted).
   */
  async cancel(req, res, next) {
    try {
      const user = await resolveUser(req.user.uid);
      const trip = await tripService.cancelTrip(req.params.id, user._id);
      res.status(200).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TripController();
