const mongoose = require('mongoose');
const validator = require('validator');
const { z } = require('zod');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'El nombre completo es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Por favor, proporcione un correo electrónico válido']
  },
  phone: {
    type: String,
    required: [true, 'El número de teléfono es obligatorio'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'El género es obligatorio']
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
    required: [true, 'El UID de Firebase es obligatorio'],
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
  }
}, {
  timestamps: true
});

// Zod Schema para validación de entrada (Request Body)
const userValidationSchema = z.object({
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(7, 'Teléfono inválido'),
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
