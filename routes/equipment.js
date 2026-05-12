const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');

// GET all equipment
router.get('/', async (req, res) => {
  try {
    const items = await Equipment.find().sort({ name: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST new equipment
router.post('/', async (req, res) => {
  try {
    const item = new Equipment(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT update equipment
router.put('/:id', async (req, res) => {
  try {
    const item = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE equipment
router.delete('/:id', async (req, res) => {
  try {
    await Equipment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Equipment deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
