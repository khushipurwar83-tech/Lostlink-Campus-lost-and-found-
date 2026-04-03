// ============================================================
// models/Item.js — Defines what a Lost/Found post looks like
// ============================================================

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  // "lost" or "found" — what type of post is this?
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: [true, 'Item type (lost/found) is required']
  },

  // Title of the item (e.g., "Blue Water Bottle")
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100
  },

  // Detailed description of the item
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 1000
  },

  // Category for filtering (e.g., "Electronics", "Clothing")
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Electronics',
      'Clothing & Accessories',
      'Books & Stationery',
      'ID & Documents',
      'Keys',
      'Bags & Wallets',
      'Sports Equipment',
      'Jewelry',
      'Other'
    ]
  },

  // Where the item was lost/found on campus
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },

  // Date it was lost or found
  date: {
    type: Date,
    required: [true, 'Date is required']
  },

  // Path to uploaded photo (stored on server)
  photo: {
    type: String,
    default: null
  },

  // Status of the post
  status: {
    type: String,
    enum: ['active', 'claimed', 'resolved', 'closed'],
    default: 'active'
  },

  // Reference to the user who posted this item
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Links to User model
    required: true
  },

  // When the post was created on our system
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ── Text Index: Allows MongoDB full-text search ───────────────
itemSchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('Item', itemSchema);
