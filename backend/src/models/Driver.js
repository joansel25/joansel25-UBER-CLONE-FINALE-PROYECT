const mongoose = require('mongoose');
const { z } = require('zod');

const driverSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  vehicleInfo: {
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    color: { type: String, required: true },
    plate: { type: String, required: true, unique: true }
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline'
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  }
}, {
  timestamps: true
});

// Índice para búsquedas geoespaciales
driverSchema.index({ currentLocation: '2dsphere' });

// Zod Schema para validación de entrada
const driverValidationSchema = z.object({
  userId: z.string(),
  vehicleInfo: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int().min(1900),
    color: z.string(),
    plate: z.string()
  }),
  licenseNumber: z.string()
});

const Driver = mongoose.model('Driver', driverSchema);

module.exports = {
  Driver,
  driverValidationSchema
};
