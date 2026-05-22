const mongoose = require('mongoose');
const validator = require('validator');
const { z } = require('zod');

/**
 * User persistence schema.
 * Supports both passengers and drivers.
 */
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Invalid email format']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  language: {
    type: String,
    enum: ['ES', 'EN'],
    default: 'ES'
  },
  profilePic: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
  },
  role: {
    type: String,
    enum: ['passenger', 'driver', 'admin'],
    default: 'passenger'
  },
  firebaseUid: {
    type: String,
    required: [true, 'Firebase UID is required'],
    unique: true
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  stripeCustomerId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

/**
 * Request validation schema.
 * Enforces data integrity before processing the business logic.
 */
const userValidationSchema = z.object({
  fullName: z.string().min(3, 'Name too short'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Invalid phone number'),
  gender: z.enum(['male', 'female', 'other']),
  language: z.enum(['ES', 'EN']).optional(),
  firebaseUid: z.string(),
  role: z.enum(['passenger', 'driver', 'admin']).optional()
});

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  userValidationSchema
};
