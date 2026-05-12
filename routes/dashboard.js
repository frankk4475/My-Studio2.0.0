const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Quote = require('../models/Quote');
const Invoice = require('../models/Invoice');
const Equipment = require('../models/Equipment');
const Assignment = require('../models/Assignment');
const Customer = require('../models/Customer');

router.get('/stats', async (req, res) => {
  try {
    const [
      bookings,
      quotes,
      invoices,
      equipment,
      assignments,
      lineCustomers,
      totalCustomers
    ] = await Promise.all([
      Booking.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Quote.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: { $ifNull: ["$grandTotal", "$total"] } } } }
      ]),
      Invoice.aggregate([
        { $group: { 
          _id: "$paymentStatus", 
          count: { $sum: 1 }, 
          total: { $sum: { $ifNull: ["$grandTotal", "$total"] } },
          paid: { $sum: "$amountPaid" }
        }}
      ]),
      Equipment.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Assignment.countDocuments({ status: { $ne: 'Completed' } }),
      Customer.countDocuments({ lineUserId: { $exists: true, $ne: '' } }),
      Customer.countDocuments()
    ]);

    const stats = {
      bookings: {
        total: bookings.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: bookings.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {})
      },
      quotes: {
        total: quotes.reduce((acc, curr) => acc + curr.count, 0),
        totalAmount: quotes.reduce((acc, curr) => acc + curr.total, 0),
        byStatus: quotes.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {})
      },
      invoices: {
        total: invoices.reduce((acc, curr) => acc + curr.count, 0),
        totalAmount: invoices.reduce((acc, curr) => acc + curr.total, 0),
        totalPaid: invoices.reduce((acc, curr) => acc + curr.paid, 0),
        totalPending: invoices.reduce((acc, curr) => {
          if (curr._id === 'Paid') return acc;
          return acc + Math.max(0, curr.total - curr.paid);
        }, 0),
        byStatus: invoices.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {})
      },
      equipment: {
        total: equipment.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: equipment.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {})
      },
      activeAssignments: assignments,
      lineStats: {
        linked: lineCustomers,
        total: totalCustomers
      }
    };

    res.json(stats);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: err.message });
  }
});

module.exports = router;
