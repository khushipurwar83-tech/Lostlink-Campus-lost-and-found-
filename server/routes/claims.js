// ============================================================
// routes/claims.js — Handles claim requests for items
// ============================================================

const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const { protect } = require('../middleware/auth');

// ── POST /api/claims — Submit a claim for an item ─────────────
router.post('/', protect, async (req, res) => {
  try {
    const { itemId, message, contactInfo } = req.body;

    if (!itemId || !message || !contactInfo) {
      return res.status(400).json({ message: 'Item ID, message, and contact info are required' });
    }

    // Check that the item exists
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Prevent users from claiming their own posts
    if (item.postedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot claim your own post' });
    }

    // Check if this user already submitted a claim for this item
    const existingClaim = await Claim.findOne({ item: itemId, claimedBy: req.user._id });
    if (existingClaim) {
      return res.status(400).json({ message: 'You have already submitted a claim for this item' });
    }

    const claim = await Claim.create({
      item: itemId,
      claimedBy: req.user._id,
      message,
      contactInfo
    });

    await claim.populate([
      { path: 'claimedBy', select: 'name collegeId email' },
      { path: 'item', select: 'title type' }
    ]);

    res.status(201).json({ message: 'Claim submitted successfully!', claim });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already submitted a claim for this item' });
    }
    console.error('Claim error:', error);
    res.status(500).json({ message: 'Failed to submit claim' });
  }
});

// ── GET /api/claims/item/:itemId — Get all claims for an item ─
// Only the item's poster can see the claims
router.get('/item/:itemId', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Only the poster can see who claimed their item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view these claims' });
    }

    const claims = await Claim.find({ item: req.params.itemId })
      .populate('claimedBy', 'name collegeId email department phone')
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch claims' });
  }
});

// ── GET /api/claims/mine — Get claims submitted by current user ─
router.get('/mine', protect, async (req, res) => {
  try {
    const claims = await Claim.find({ claimedBy: req.user._id })
      .populate('item', 'title type category location photo status')
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your claims' });
  }
});

// ── PATCH /api/claims/:id — Approve or reject a claim ────────
// Only the item's poster can approve/reject
router.patch('/:id', protect, async (req, res) => {
  try {
    const { status, responseNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const claim = await Claim.findById(req.params.id).populate('item');
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // Only the item poster can respond to claims
    if (claim.item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    claim.status = status;
    if (responseNote) claim.responseNote = responseNote;
    await claim.save();

    // If approved, mark the item as resolved
    if (status === 'approved') {
      await Item.findByIdAndUpdate(claim.item._id, { status: 'resolved' });
    }

    res.json({ message: `Claim ${status}!`, claim });

  } catch (error) {
    res.status(500).json({ message: 'Failed to update claim' });
  }
});

module.exports = router;

