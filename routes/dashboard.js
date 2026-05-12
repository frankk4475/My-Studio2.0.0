const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

router.get('/', async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      bookingsCount,
      lineConnectedCount,
      pendingBookingsCount,
      revenueMonthResult,
      recentBookings,
      revenueHistoryRaw
    ] = await Promise.all([
      Booking.countDocuments(),
      Customer.countDocuments({ lineUserId: { $exists: true, $ne: '' } }),
      Booking.countDocuments({ status: 'Pending' }),
      Invoice.aggregate([
        { 
          $match: { 
            createdAt: { $gte: firstDayOfMonth }, 
            paymentStatus: 'Paid' 
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: { $ifNull: ["$grandTotal", "$total"] } } 
          } 
        }
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(5).lean(),
      Invoice.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" }
            },
            total: { $sum: { $ifNull: ["$grandTotal", "$total"] } }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 }
      ])
    ]);

    // Format revenue history for Chart.js
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const revenueHistory = revenueHistoryRaw.map(h => ({
      month: `${monthNames[h._id.month - 1]} ${h._id.year}`,
      amount: h.total
    })).reverse();

    res.json({
      bookingsCount,
      lineConnectedCount,
      pendingBookingsCount,
      revenueMonth: revenueMonthResult[0]?.total || 0,
      recentBookings,
      revenueHistory
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = router;
