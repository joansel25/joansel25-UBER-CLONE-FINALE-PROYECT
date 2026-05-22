const { admin } = require('../config/firebase');

/**
 * Manages real-time driver location via Firebase Realtime Database.
 *
 * Firebase structure:
 *   /drivers/{driverId}/location  → { lat, lng, timestamp, tripId? }
 *   /trips/{tripId}/tracking      → { driverId, status, startedAt, endedAt? }
 *
 * The frontend (React Native) subscribes directly to these paths using
 * the Firebase JS SDK — no polling to the backend needed.
 */
class TrackingService {

  _db() {
    return admin.database();
  }

  /**
   * Writes the driver's current position to Firebase.
   * Called every time the driver app sends a location update.
   * driverId = Driver document _id (MongoDB ObjectId as string)
   */
  async updateDriverLocation(driverId, latitude, longitude, tripId = null) {
    const payload = {
      lat:       latitude,
      lng:       longitude,
      timestamp: Date.now(),
    };
    if (tripId) payload.tripId = tripId;

    await this._db().ref(`drivers/${driverId}/location`).set(payload);
    return payload;
  }

  /**
   * Returns the last known position of a driver.
   * Returns null if no location has been set.
   */
  async getDriverLocation(driverId) {
    const snapshot = await this._db().ref(`drivers/${driverId}/location`).once('value');
    return snapshot.val();
  }

  /**
   * Removes a driver's location node (called when driver goes offline).
   */
  async clearDriverLocation(driverId) {
    await this._db().ref(`drivers/${driverId}/location`).remove();
  }

  /**
   * Marks a trip as actively tracked in Firebase.
   * Called when a driver starts a trip.
   */
  async startTripTracking(tripId, driverId) {
    await this._db().ref(`trips/${tripId}/tracking`).set({
      driverId,
      status:    'active',
      startedAt: Date.now(),
    });
  }

  /**
   * Marks a trip tracking session as ended.
   * Called when a trip is completed or cancelled.
   */
  async endTripTracking(tripId) {
    await this._db().ref(`trips/${tripId}/tracking`).update({
      status:  'ended',
      endedAt: Date.now(),
    });
  }
}

module.exports = new TrackingService();
