// ============================================================
// routes/items.js — All routes for Lost & Found posts
// Handles: create, read, update, delete, search, filter
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const { protect } = require('../middleware/auth');

// ── Multer Setup: Handles photo uploads ───────────────────────
// Multer is like a bouncer for file uploads — it checks file type & size
const storage = multer.diskStorage({
  // Where to save files on the server
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create uploads folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },

  // What to name the file (timestamp + original name to avoid conflicts)
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5MB per file
});

// ── GET /api/items — Get all items with search & filter ───────
router.get('/', async (req, res) => {
  try {
    const { type, category, location, dateFrom, dateTo, search, page = 1, limit = 12 } = req.query;

    // Build a query object based on provided filters
    let query = { status: { $ne: 'closed' } }; // Exclude closed posts

    // Filter by type (lost/found)
    if (type && ['lost', 'found'].includes(type)) {
      query.type = type;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by location (partial match, case insensitive)
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo + 'T23:59:59');
    }

    // Full-text search (uses the text index we created in Item model)
    if (search) {
      query.$text = { $search: search };
    }

    // Count total results for pagination
    const total = await Item.countDocuments(query);

    // Fetch paginated results, newest first
    // .populate('postedBy') fills in user details from the User model
    const items = await Item.find(query)
      .populate('postedBy', 'name collegeId department') // Get poster's info
      .sort({ createdAt: -1 })  // Newest first
      .skip((page - 1) * limit) // Skip items for previous pages
      .limit(parseInt(limit));  // Only return 'limit' items per page

    res.json({
      items,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalItems: total
    });

  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

// ── GET /api/items/:id — Get single item by ID ────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('postedBy', 'name collegeId department phone email');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch item' });
  }
});

// ── POST /api/items — Create a new lost/found post ────────────
// 'protect' middleware ensures only logged-in users can post
// upload.single('photo') handles the uploaded photo file
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    const { type, title, description, category, location, date } = req.body;

    // Validate required fields
    if (!type || !title || !description || !category || !location || !date) {
      return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    // Build the item object
    const itemData = {
      type,
      title,
      description,
      category,
      location,
      date: new Date(date),
      postedBy: req.user._id  // The logged-in user is the poster
    };

    // If a photo was uploaded, save its path
    if (req.file) {
      itemData.photo = `/uploads/${req.file.filename}`;
    }

    const item = await Item.create(itemData);

    // Return the created item with poster info
    await item.populate('postedBy', 'name collegeId department');

    res.status(201).json({
      message: 'Post created successfully!',
      item
    });

  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

// ── PUT /api/items/:id — Update a post (only by original poster) ──
router.put('/:id', protect, upload.single('photo'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Only the person who posted can edit it
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    const updates = req.body;
    if (req.file) {
      updates.photo = `/uploads/${req.file.filename}`;
    }

    const updatedItem = await Item.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('postedBy', 'name collegeId department');

    res.json({ message: 'Post updated!', item: updatedItem });

  } catch (error) {
    res.status(500).json({ message: 'Failed to update post' });
  }
});

// ── PATCH /api/items/:id/status — Update post status ─────────
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await Item.findById(req.params.id);

    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    item.status = status;
    await item.save();

    res.json({ message: 'Status updated', item });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// ── DELETE /api/items/:id — Delete a post ─────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

// ── GET /api/items/user/mine — Get current user's posts ───────
router.get('/user/mine', protect, async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your posts' });
  }
});

module.exports = router;
