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

// 1. Helmet & CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "https://sprofile.line-scdn.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({ origin: true, credentials: true }));

// 2. Custom Body Parser for LINE Webhook (Keep Raw Body for signature verification)
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    const url = req.originalUrl || req.url || '';
    if (url.includes('/webhook')) {
      req.rawBody = buf;
      // console.log('DEBUG: rawBody captured for', url);
    }
  }
}));

// 3. Models
require('./models/Booking');
require('./models/Quote');
require('./models/Invoice');
require('./models/Customer');
const User = require('./models/User');
const Settings = require('./models/Settings');

// 4. Init Check Middleware
app.use(async (req, res, next) => {
  const publicPaths = [
    '/login.html', '/login.js', 
    '/setup.html', '/setup.js', 
    '/register.html', '/register.js',
    '/booking-detail.html',
    '/quote-detail.html',
    '/billing-detail.html',
    '/receipt-detail.html',
    '/loan-detail.html',
    '/api/users/check-init',
 '/api/users/init', 
    '/api/customers/register-via-line',
    '/api/settings/public',
    '/styles.css', '/favicon.ico', '/api/line/webhook'
  ];
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

// 5. Routes
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.use(express.static('public'));

app.use('/api/line', require('./routes/line'));
app.use('/api/users', require('./routes/auth'));

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  if (req.path.startsWith('/api/line')) return next();
  if (req.path === '/api/customers/register-via-line') return next();
  if (req.path.endsWith('/public')) return next(); // Publicly accessible doc APIs
  const hdr = req.headers['authorization'] || '';
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

app.use('/api', authMiddleware);
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));

const connectDB = require('./config/db');
const socketService = require('./services/socketService');

// Connect to Database
connectDB();

const server = require('http').createServer(app);
socketService.init(server);

server.listen(PORT, () => console.log(`🚀 Server is running at http://localhost:${PORT}`));

// 7. Logo Upload
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const filename = `logo_${Date.now()}${path.extname(req.file.originalname)}`;
    fs.renameSync(req.file.path, path.join(uploadsDir, filename));
    const url = `/uploads/${filename}`;
    let s = await Settings.findOne() || await new Settings({}).save();
    await Settings.findByIdAndUpdate(s._id, { 'business.logoUrl': url });
    res.json({ ok: true, url });
  } catch (e) { res.status(500).json({ message: 'Upload failed' }); }
});
