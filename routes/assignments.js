const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Equipment = require('../models/Equipment');

// GET all assignments
router.get('/', async (req, res) => {
  try {
    const list = await Assignment.find()
      .populate('bookingId')
      .populate('employeeId', 'username displayName jobTitle')
      .populate('equipmentIds')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

// GET single assignment
router.get('/:id', async (req, res) => {
  try {
    const item = await Assignment.findById(req.params.id)
      .populate('bookingId')
      .populate('employeeId', 'username displayName jobTitle')
      .populate('equipmentIds');
    if (!item) return res.status(404).json({ message: 'Assignment not found' });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

// GET single assignment (Public)
router.get('/:id/public', async (req, res) => {
  try {
    const item = await Assignment.findById(req.params.id)
      .populate('bookingId')
      .populate('employeeId', 'username displayName jobTitle')
      .populate('equipmentIds');
    if (!item) return res.status(404).json({ message: 'Assignment not found' });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

// POST create assignment
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    // Generate Document Number if not provided
    if (!data.documentNumber) {
      const now = new Date();
      const prefix = `LN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = await Assignment.countDocuments({ documentNumber: new RegExp(`^${prefix}`) });
      data.documentNumber = `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }

    const assignment = new Assignment(data);
    await assignment.save();
    
    // Update equipment status if assigned
    if (data.equipmentIds && data.equipmentIds.length > 0) {
      await Equipment.updateMany(
        { _id: { $in: data.equipmentIds } },
        { status: 'In Use' }
      );
    }
    
    res.status(201).json(assignment);
  } catch (e) {
    console.error('Create Assignment Error:', e);
    res.status(400).json({ message: e.message });
  }
});

// PUT update assignment status
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    assignment.status = status;
    if (status === 'Completed') {
      assignment.completedAt = new Date();
      // Return equipment to Available
      if (assignment.equipmentIds.length > 0) {
        await Equipment.updateMany(
          { _id: { $in: assignment.equipmentIds } },
          { status: 'Available' }
        );
      }
    }
    await assignment.save();
    res.json(assignment);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
