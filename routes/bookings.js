const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const lineService = require('../services/lineService');
const socketService = require('../services/socketService');

router.get('/', async (req, res) => {
  try {
    const { start, end, page = 1, limit = 50 } = req.query;
    const q = {};
    const lim  = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
    if (start && end) {
      const s = new Date(start), e = new Date(end);
      if (!isNaN(s) && !isNaN(e)) q.date = { $gte: s, $lte: e };
    }
    const [rows, total] = await Promise.all([
      Booking.find(q).sort({ date: -1 }).skip(skip).limit(lim).lean(),
      Booking.countDocuments(q)
    ]);
    res.json({ data: rows, total, page: Number(page), limit: lim });
  } catch (e) { res.status(500).json({ message: 'Error.' }); }
});

router.post('/', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    
    // Socket.io notification
    socketService.emit('bookingCreated', booking);

    // Notify LINE Admins
    const dateStr = new Date(booking.date).toLocaleDateString('th-TH');
    lineService.notifyAdmins(`🆕 จองใหม่!\nลูกค้า: ${booking.customer}\nวันที่: ${dateStr}\nเวลา: ${booking.startTime} - ${booking.endTime}\nประเภท: ${booking.bookingType}`);
    
    res.status(201).json(booking);
  } catch (e) { res.status(400).json({ message: 'Error.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    res.json(booking);
  } catch (e) { res.status(500).json({ message: 'Error.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    
    // Socket.io notification
    socketService.emit('bookingUpdated', booking);
    
    res.json(booking);
  } catch (e) { res.status(400).json({ message: 'Error.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    
    // Socket.io notification
    socketService.emit('bookingDeleted', { id: req.params.id });
    
    res.json({ message: 'Booking deleted successfully.' });
  } catch (e) { res.status(500).json({ message: 'Error.' }); }
});

module.exports = router;
