const { Driver } = require('../models/Driver');


class GeoService {

  /**
   * Finds all available drivers within a specified radius.
   * Calculates the exact distance in meters.
   * 
   * @param  longitude - Center point longitude.
   * @param  latitude - Center point latitude.
   * @param  [options] - Optional search parameters.
   * @param [options.maxDistance=5000] - Max distance radius in meters.
   * @param  [options.limit=10] - Maximum number of drivers to return.
   * @returns {Promise<Array>} Drivers with computed distance and populated user details.
   */
  async findNearbyDrivers(longitude, latitude, options = {}) {
    const maxDistance = Number(options.maxDistance) || 5000;
    const limit = Number(options.limit) || 10;

    // 1. Validate coordinates range
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      const error = new Error('Invalid coordinates range. Longitude [-180, 180], Latitude [-90, 90]');
      error.statusCode = 400;
      throw error;
    }

    if (maxDistance <= 0 || limit <= 0) {
      const error = new Error('maxDistance and limit must be positive numbers');
      error.statusCode = 400;
      throw error;
    }

    // 2. Perform aggregation to fetch nearest drivers and calculate exact distance
    const nearbyDrivers = await Driver.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          distanceField: 'distance', 
          maxDistance: maxDistance,
          query: { status: 'available' }, 
          spherical: true
        }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'users', 
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user' 
      },
      {
        $project: {
          _id: 1,
          status: 1,
          vehicleInfo: 1,
          currentLocation: 1,
          distance: 1,
          'user.fullName': 1,
          'user.email': 1,
          'user.phone': 1,
          'user.rating': 1,
          'user.profilePic': 1
        }
      }
    ]);

    return nearbyDrivers;
  }
}

module.exports = new GeoService();
