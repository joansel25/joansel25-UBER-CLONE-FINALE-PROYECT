const Trip = require('../models/Trip');
const { User } = require('../models/User');

/**
 * Business logic for the trip lifecycle.
 * Controllers call these methods; they never touch HTTP objects.
 */
class TripService {

  /**
   * Persists a new trip in 'requested' status.
   */
  async createTrip({ passengerId, origin, destination, vehicleCategory, paymentMethod, fare, distanceKm, durationMin, polyline }) {
    const trip = await Trip.create({
      passenger:       passengerId,
      origin: {
        address:  origin.address,
        location: { type: 'Point', coordinates: [origin.lng, origin.lat] },
      },
      destination: {
        address:  destination.address,
        location: { type: 'Point', coordinates: [destination.lng, destination.lat] },
      },
      vehicleCategory,
      paymentMethod: paymentMethod || 'cash',
      fare,
      distance: distanceKm,
      duration: durationMin,
      polyline,
      status: 'requested',
    });

    return trip;
  }

  /**
   * Returns all trips for a user, newest first, paginated.
   * Works for both passenger and driver roles.
   */
  async getUserTrips(userId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [trips, total] = await Promise.all([
      Trip.find({ $or: [{ passenger: userId }, { driver: userId }] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('passenger', 'fullName phone profilePic rating')
        .populate('driver',    'fullName phone profilePic rating'),
      Trip.countDocuments({ $or: [{ passenger: userId }, { driver: userId }] }),
    ]);

    return { trips, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Returns a single trip by ID.
   * Throws 404 if not found.
   */
  async getTripById(tripId) {
    const trip = await Trip.findById(tripId)
      .populate('passenger', 'fullName phone profilePic rating')
      .populate('driver',    'fullName phone profilePic rating');

    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }

    return trip;
  }

  /**
   * Driver accepts a requested trip.
   */
  async acceptTrip(tripId, driverId) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (trip.status !== 'requested') {
      const err = new Error(`Cannot accept a trip with status '${trip.status}'`);
      err.statusCode = 409;
      throw err;
    }

    trip.driver     = driverId;
    trip.status     = 'accepted';
    trip.acceptedAt = new Date();
    await trip.save();

    return trip.populate(['passenger', 'driver']);
  }

  /**
   * Driver starts an accepted trip.
   */
  async startTrip(tripId, driverId) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (trip.status !== 'accepted') {
      const err = new Error(`Cannot start a trip with status '${trip.status}'`);
      err.statusCode = 409;
      throw err;
    }
    if (trip.driver.toString() !== driverId.toString()) {
      const err = new Error('Only the assigned driver can start this trip');
      err.statusCode = 403;
      throw err;
    }

    trip.status    = 'ongoing';
    trip.startedAt = new Date();
    await trip.save();

    return trip;
  }

  /**
   * Driver completes an ongoing trip.
   */
  async completeTrip(tripId, driverId) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (trip.status !== 'ongoing') {
      const err = new Error(`Cannot complete a trip with status '${trip.status}'`);
      err.statusCode = 409;
      throw err;
    }
    if (trip.driver.toString() !== driverId.toString()) {
      const err = new Error('Only the assigned driver can complete this trip');
      err.statusCode = 403;
      throw err;
    }

    trip.status      = 'completed';
    trip.completedAt = new Date();
    await trip.save();

    return trip;
  }

  /**
   * Records a rating from the authenticated user for the other party in a trip.
   * Passenger rates driver; driver rates passenger. Each party can rate only once.
   * Recalculates the rated user's average rating across all completed trips.
   */
  async rateTrip(tripId, raterUserId, rating) {
    const trip = await Trip.findById(tripId)
      .populate('passenger', '_id')
      .populate('driver', '_id');

    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (trip.status !== 'completed') {
      const err = new Error('Can only rate completed trips');
      err.statusCode = 409;
      throw err;
    }

    const isPassenger = trip.passenger._id.toString() === raterUserId.toString();
    const isDriver    = trip.driver?._id.toString() === raterUserId.toString();

    if (!isPassenger && !isDriver) {
      const err = new Error('Not authorized to rate this trip');
      err.statusCode = 403;
      throw err;
    }

    if (isPassenger) {
      if (trip.passengerRatingDriver != null) {
        const err = new Error('You have already rated this trip');
        err.statusCode = 409;
        throw err;
      }
      await Trip.findByIdAndUpdate(tripId, { passengerRatingDriver: rating });

      if (trip.driver) {
        const ratings = await Trip.find({
          driver: trip.driver._id,
          passengerRatingDriver: { $ne: null },
        }).select('passengerRatingDriver');
        const avg = ratings.reduce((sum, t) => sum + t.passengerRatingDriver, 0) / ratings.length;
        await User.findByIdAndUpdate(trip.driver._id, { rating: +avg.toFixed(1) });
      }
    } else {
      if (trip.driverRatingPassenger != null) {
        const err = new Error('You have already rated this trip');
        err.statusCode = 409;
        throw err;
      }
      await Trip.findByIdAndUpdate(tripId, { driverRatingPassenger: rating });

      const ratings = await Trip.find({
        passenger: trip.passenger._id,
        driverRatingPassenger: { $ne: null },
      }).select('driverRatingPassenger');
      const avg = ratings.reduce((sum, t) => sum + t.driverRatingPassenger, 0) / ratings.length;
      await User.findByIdAndUpdate(trip.passenger._id, { rating: +avg.toFixed(1) });
    }

    return await Trip.findById(tripId)
      .populate('passenger', 'fullName rating')
      .populate('driver',    'fullName rating');
  }

  /**
   * Returns all trips with status 'requested', newest first, paginated.
   * Used by drivers to see open requests.
   */
  async getAvailableTrips({ page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [trips, total] = await Promise.all([
      Trip.find({ status: 'requested' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('passenger', 'fullName phone profilePic rating'),
      Trip.countDocuments({ status: 'requested' }),
    ]);

    return { trips, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Cancels a trip. Allowed while status is 'requested' or 'accepted'.
   */
  async cancelTrip(tripId, userId) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
    if (!['requested', 'accepted'].includes(trip.status)) {
      const err = new Error(`Cannot cancel a trip with status '${trip.status}'`);
      err.statusCode = 409;
      throw err;
    }

    const isPassenger = trip.passenger.toString() === userId.toString();
    const isDriver    = trip.driver && trip.driver.toString() === userId.toString();

    if (!isPassenger && !isDriver) {
      const err = new Error('Not authorized to cancel this trip');
      err.statusCode = 403;
      throw err;
    }

    trip.status = 'cancelled';
    await trip.save();

    return trip;
  }
}

module.exports = new TripService();
