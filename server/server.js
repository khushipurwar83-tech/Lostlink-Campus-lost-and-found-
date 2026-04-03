// ============================================================
// server.js — The heart of our backend
// This file starts the Express web server and connects routes
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load variables from .env file

const app = express();

// ── Middleware (code that runs on every request) ──────────────
app.use(cors()); // Allow frontend (different port) to talk to backend
app.use(express.json()); // Parse incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form data

// Serve uploaded images as static files at /uploads URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend files (HTML/CSS/JS) from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Database Connection ───────────────────────────────────────
//mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('👉 Check your MONGODB_URI in .env file');
    process.exit(1);
  });

// ── API Routes ────────────────────────────────────────────────
// Each route file handles a specific feature area
app.use('/api/auth', require('./routes/auth'));       // Login / Register
app.use('/api/items', require('./routes/items'));     // Lost & Found posts
app.use('/api/claims', require('./routes/claims'));   // Claim requests

// ── Catch-all: Send frontend for any non-API route ────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

// ── Start Listening ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload folder: ${path.join(__dirname, 'uploads')}`);
});
