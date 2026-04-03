// ============================================================
// routes/auth.js — Handles user registration and login
// ============================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ── Helper: Generate a JWT token for a user ───────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },           // Payload: what we encode in the token
    process.env.JWT_SECRET,   // Secret key to sign with
    { expiresIn: '7d' }       // Token expires in 7 days
  );
};

// ── POST /api/auth/register — Create a new account ───────────
router.post('/register', async (req, res) => {
  try {
    const { collegeId, name, email, password, department, phone } = req.body;

    // Check all required fields
    if (!collegeId || !name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    // Check if college ID already exists
    const existingId = await User.findOne({ collegeId: collegeId.toUpperCase() });
    if (existingId) {
      return res.status(400).json({ message: 'This College ID is already registered' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'This email is already registered' });
    }

    // Create the user (password gets hashed automatically via pre-save hook)
    const user = await User.create({
      collegeId,
      name,
      email,
      password,
      department,
      phone
    });

    // Send back user info + token
    res.status(201).json({
      message: 'Account created successfully!',
      token: generateToken(user._id),
      user: {
        id: user._id,
        collegeId: user.collegeId,
        name: user.name,
        email: user.email,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login — Login with college ID + password ──
router.post('/login', async (req, res) => {
  try {
    const { collegeId, password } = req.body;

    if (!collegeId || !password) {
      return res.status(400).json({ message: 'College ID and password are required' });
    }

    // Find user by college ID
    const user = await User.findOne({ collegeId: collegeId.toUpperCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid College ID or password' });
    }

    // Check password using our comparePassword method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid College ID or password' });
    }

    // Login successful!
    res.json({
      message: 'Login successful!',
      token: generateToken(user._id),
      user: {
        id: user._id,
        collegeId: user.collegeId,
        name: user.name,
        email: user.email,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me — Get current logged-in user's profile ──
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
