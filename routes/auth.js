const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// Internal Auth Middleware for specific routes
const auth = async (req, res, next) => {
  const hdr = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = /^Bearer\s+(.+)$/i.test(hdr) ? hdr.replace(/^Bearer\s+/i, '') : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = { userId: user._id, role: user.role, displayName: user.displayName };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ message: 'Access denied. Admins only.' });
  next();
};

// Check if any user exists (for first-time setup)
router.get('/check-init', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ initialized: count > 0 });
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Initialize first admin user
router.post('/init', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ message: 'System already initialized.' });

    const { username = '', password = '', displayName = '' } = req.body || {};
    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ message: 'Username (min 3) or Password (min 6) too short.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      displayName: displayName || username,
      role: 'Admin'
    });
    await user.save();

    res.status(201).json({ message: 'Admin user created successfully.' });
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/register', auth, isAdmin, authLimiter, async (req, res) => {
  try {
    const { username = '', password = '', displayName = '', role = 'Employee', jobTitle = '' } = req.body || {};
    if (username.length < 3 || password.length < 6) return res.status(400).json({ message: 'Username/Password too short.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ 
      username, 
      password: hashedPassword,
      displayName: displayName || username,
      role,
      jobTitle
    }).save();
    res.status(201).json({ message: 'User created successfully.' });
  } catch (e) {
    if (e?.code === 11000) return res.status(400).json({ message: 'Username already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username = '', password = '' } = req.body || {};
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials.' });
    const token = jwt.sign({ 
      userId: user._id,
      role: user.role 
    }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
    res.json({ token, role: user.role, displayName: user.displayName });
  } catch (e) { res.status(500).json({ message: 'Server error.' }); }
});

router.get('/list', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'username displayName role jobTitle _id createdAt');
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { password, displayName, role, jobTitle } = req.body;
    const update = {};
    if (password) update.password = await bcrypt.hash(password, 10);
    if (displayName) update.displayName = displayName;
    if (role) update.role = role;
    if (jobTitle) update.jobTitle = jobTitle;

    await User.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ message: 'User updated successfully' });
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
