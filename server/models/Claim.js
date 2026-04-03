// ============================================================
// models/Claim.js — Defines a claim request for an item
// When someone says "That's my lost item!", they submit a claim
// ============================================================

const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  // Which item is being claimed? (links to Item model)
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },

  // Who is submitting the claim? (links to User model)
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Why do they think it's theirs? (proof of ownership)
  message: {
    type: String,
    required: [true, 'Please describe why this item belongs to you'],
    trim: true,
    maxlength: 500
  },

  // Contact info for the claimer
  contactInfo: {
    type: String,
    required: [true, 'Contact information is required'],
    trim: true
  },

  // Status of the claim request
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Optional note from the item poster when approving/rejecting
  responseNote: {
    type: String,
    trim: true
  },

  // When the claim was submitted
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate claims: one user can only claim one item once
claimSchema.index({ item: 1, claimedBy: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
