// ============================================================
// models/User.js — Defines what a "User" looks like in MongoDB
// Think of this as the template/blueprint for user accounts
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords securely

const userSchema = new mongoose.Schema({
  // College ID — unique identifier (e.g., "CS2021001")
  collegeId: {
    type: String,
    required: [true, 'College ID is required'],
    unique: true,
    uppercase: true,
    trim: true
  },

  // Full name of the student
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },

  // Email address
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Please enter a valid email']
  },

  // Password — will be hashed before saving (never stored as plain text!)
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },

  // Department / Branch (optional)
  department: {
    type: String,
    trim: true
  },

  // Phone number (optional, for contact)
  phone: {
    type: String,
    trim: true
  },

  // When the account was created
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ── Pre-save Hook: Hash password before saving to database ────
// This runs automatically every time a user is saved
userSchema.pre('save', async function(next) {
  // Only hash if password was changed (avoid re-hashing on other updates)
  if (!this.isModified('password')) return next();

  // bcrypt.hash() scrambles the password with 10 rounds of salting
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Instance Method: Check if password matches ────────────────
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
