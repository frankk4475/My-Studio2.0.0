require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set');
  process.exit(1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: true, credentials: true }));

// 1. LINE Webhook (Must be before any other parsers or auth)
app.use('/api/line', require('./routes/line'));

// 2. Body Parser
app.use(express.json({ limit: '1mb' }));

require('./models/Booking');
require('./models/Quote');
require('./models/Invoice');
const User = require('./models/User');
const Settings = require('./models/Settings');

// 3. Init Check Middleware
app.use(async (req, res, next) => {
  const publicPaths = ['/setup.html', '/setup.js', '/api/users/check-init', '/api/users/init', '/styles.css', '/favicon.ico', '/api/line/webhook'];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p))) return next();
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      if (req.path.startsWith('/api')) return res.status(403).json({ message: 'System not initialized', needsInit: true });
      return res.redirect('/setup.html');
    }
  } catch (err) { console.error('Init check error:', err); }
  next();
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studioDB';
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected.');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

app.listen(PORT, () => console.log(`🚀 Server is running at http://localhost:${PORT}`));

// 4. Auth Middleware with LINE exclusion
const authMiddleware = async (req, res, next) => {
  // บังคับข้ามการตรวจ Token สำหรับ LINE Webhook
  if (req.path.startsWith('/api/line')) {
    return next();
  }

  const hdr = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = /^Bearer\s+(.+)$/i.test(hdr) ? hdr.replace(/^Bearer\s+/i, '') : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = { userId: payload.userId, role: user.role, displayName: user.displayName };
    next();
  } catch (err) { return res.status(401).json({ message: 'Invalid token' }); }
};

app.use('/api/users', require('./routes/auth'));
app.use('/api', authMiddleware);
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/dashboard', require('./routes/dashboard'));

const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png');
    cb(null, `logo${ext.toLowerCase()}`);
  }
});
const upload = multer({ storage });

app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const url = `/uploads/${req.file.filename}`;
    let s = await Settings.findOne() || await new Settings({}).save();
    const updated = await Settings.findByIdAndUpdate(s._id, { 'business.logoUrl': url }, { new: true });
    res.json({ ok: true, url, settings: updated });
  } catch (e) { res.status(500).json({ message: 'Upload failed' }); }
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});
