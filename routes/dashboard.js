const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Equipment = require('../models/Equipment');
const User = require('../models/User');
const Quote = require('../models/Quote');

router.get('/', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const firstDayOfMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [
      bookingsCount,
      lineConnectedCount,
      pendingBookingsCount,
      revenueMonthResult,
      recentBookings,
      revenueHistoryRaw,
      // New studio metrics
      todayJobs,
      equipmentStats,
      staffCount,
      unpaidInvoices,
      pendingQuotes
    ] = await Promise.all([
      Booking.countDocuments(),
      Customer.countDocuments({ lineUserId: { $exists: true, $ne: '' } }),
      Booking.countDocuments({ status: 'Pending' }),
      Invoice.aggregate([
        { $match: { createdAt: { $gte: firstDayOfMonth }, paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$grandTotal", "$total"] } } } }
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(5).lean(),
      Invoice.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            total: { $sum: { $ifNull: ["$grandTotal", "$total"] } }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 }
      ]),
      // New:
      Booking.find({ date: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'Cancelled' } }).lean(),
      Equipment.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      User.countDocuments(),
      Invoice.aggregate([
        { $match: { paymentStatus: { $ne: 'Paid' } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ["$grandTotal", "$total"] } } } }
      ]),
      Quote.countDocuments({ status: { $in: ['Draft', 'Sent'] } })
    ]);

    // Format revenue history for Chart.js
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const revenueHistory = revenueHistoryRaw.map(h => ({
      month: `${monthNames[h._id.month - 1]} ${h._id.year}`,
      amount: h.total
    })).reverse();

    // Map equipment stats
    const equip = { Total: 0, Available: 0, InUse: 0, Maintenance: 0 };
    equipmentStats.forEach(s => {
      const key = s._id === 'In Use' ? 'InUse' : s._id;
      equip[key] = s.count;
      equip.Total += s.count;
    });

    res.json({
      bookingsCount,
      lineConnectedCount,
      pendingBookingsCount,
      revenueMonth: revenueMonthResult[0]?.total || 0,
      recentBookings,
      revenueHistory,
      // New response fields
      todayJobs,
      equipment: equip,
      staffCount,
      unpaidInvoices: {
        count: unpaidInvoices[0]?.count || 0,
        total: unpaidInvoices[0]?.total || 0
      },
      pendingQuotes
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = router;
