const mongoose = require('mongoose');

/**
 * Trip lifecycle management.
 * Tracks service from request to completion.
 */
const tripSchema = new mongoose.Schema({
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  origin: {
    address: String,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number] // [lng, lat]
    }
  },
  destination: {
    address: String,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number] // [lng, lat]
    }
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'ongoing', 'completed', 'cancelled'],
    default: 'requested'
  },
  fare: {
    type: Number,
    required: true
  },
  distance: Number, // in km
  duration: Number, // in minutes
  vehicleCategory: {
    type: String,
    enum: ['economy', 'xl', 'premium'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash'],
    default: 'card'
  },
  polyline: String, // Map route path
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  passengerRatingDriver: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  driverRatingPassenger: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  }
}, {
  timestamps: true
});

// Optimize proximity lookups
tripSchema.index({ 'origin.location': '2dsphere' });
tripSchema.index({ 'destination.location': '2dsphere' });

const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;
