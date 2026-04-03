// ============================================================
// middleware/auth.js — Protects routes that require login
// Acts like a security guard: checks if you have a valid token
// ============================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with "Bearer"
  // Headers look like: Authorization: Bearer eyJhbGciOi...
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract the token (everything after "Bearer ")
      token = req.headers.authorization.split(' ')[1];

      // Verify and decode the token using our secret key
      // This confirms the token hasn't been tampered with
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Look up the user from the database (excluding password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Token is valid! Continue to the actual route handler
      next();

    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized. Please log in first.' });
  }
};

module.exports = { protect };
