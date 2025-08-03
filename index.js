// --- 1. Imports ---
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- 2. App & Middleware Setup ---
const app = express();
const PORT = 3000;
app.use(express.json());
app.use(express.static('public'));

// --- 3. MongoDB Connection ---
mongoose.connect('mongodb://localhost:27017/studioDB')
  .then(() => console.log('✅ MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 4. Schemas ---
const bookingSchema = new mongoose.Schema({ customer: String, date: Date, details: String, status: { type: String, enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' } });
const quoteItemSchema = new mongoose.Schema({ description: { type: String, required: true }, quantity: { type: Number, default: 1 }, price: { type: Number, default: 0 } });
const quoteSchema = new mongoose.Schema({ bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true }, quoteNumber: String, customerName: String, items: [quoteItemSchema], total: Number, status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Declined'], default: 'Draft' }, createdAt: { type: Date, default: Date.now } });
const invoiceSchema = new mongoose.Schema({ quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', required: true }, invoiceNumber: String, customerName: String, items: [quoteItemSchema], total: Number, issueDate: { type: Date, default: Date.now }, dueDate: Date, paymentStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' } });
const userSchema = new mongoose.Schema({ username: { type: String, required: true, unique: true }, password: { type: String, required: true }, role: { type: String, enum: ['admin', 'staff'], default: 'staff' } });

// --- 5. Models ---
const Booking = mongoose.model('Booking', bookingSchema);
const Quote = mongoose.model('Quote', quoteSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const User = mongoose.model('User', userSchema);

// --- 6. Auth Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- 7. Auth Routes (Public) ---
app.post('/api/users/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).send('User created successfully.');
    } catch (error) { res.status(400).json({ message: 'Username already exists.' }); }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).send('Invalid credentials.');
        }
        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login successful!', token });
    } catch (error) { res.status(500).send('Server error.'); }
});

// --- 8. Protected API Routes ---
app.use('/api/bookings', authMiddleware);
app.use('/api/quotes', authMiddleware);
app.use('/api/invoices', authMiddleware); // **(แก้ไข)** ป้องกัน Invoice Routes

// Booking Routes
app.get('/api/bookings', async (req, res) => res.json(await Booking.find().sort({ date: -1 })));
app.post('/api/bookings', async (req, res) => res.status(201).json(await new Booking(req.body).save()));
app.get('/api/bookings/:id', async (req, res) => res.json(await Booking.findById(req.params.id)));
app.put('/api/bookings/:id', async (req, res) => res.json(await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/bookings/:id', async (req, res) => res.json(await Booking.findByIdAndDelete(req.params.id)));

// Quote Routes
app.get('/api/quotes', async (req, res) => res.json(await Quote.find().sort({ createdAt: -1 })));
app.post('/api/quotes', async (req, res) => {
    const { bookingId, items } = req.body;
    const booking = await Booking.findById(bookingId);
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const newQuote = new Quote({ ...req.body, customerName: booking.customer, total, quoteNumber: `Q-${Date.now()}` });
    res.status(201).json(await newQuote.save());
});
app.get('/api/quotes/:id', async (req, res) => res.json(await Quote.findById(req.params.id)));
app.put('/api/quotes/:id', async (req, res) => {
    const { status, items } = req.body;
    let dataToUpdate = {};

    if (status) {
        dataToUpdate.status = status;
    }

    if (items) {
        dataToUpdate.items = items;
        dataToUpdate.total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    }

    const quote = await Quote.findByIdAndUpdate(req.params.id, dataToUpdate, { new: true });

    if (status === 'Accepted') {
        await Booking.findByIdAndUpdate(quote.bookingId, { status: 'Confirmed' });
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const newInvoice = new Invoice({ quoteId: quote._id, invoiceNumber: `INV-${Date.now()}`, customerName: quote.customerName, items: quote.items, total: quote.total, dueDate });
        await newInvoice.save();
    }
    res.json(quote);
});
app.delete('/api/quotes/:id', async (req, res) => res.json(await Quote.findByIdAndDelete(req.params.id)));

// Invoice Routes
app.get('/api/invoices', async (req, res) => res.json(await Invoice.find().populate('quoteId', '_id').sort({ issueDate: -1 })));
app.get('/api/invoices/:id', async (req, res) => res.json(await Invoice.findById(req.params.id)));
app.put('/api/invoices/:id', async (req, res) => res.json(await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true })));

// --- 9. Start Server ---
app.listen(PORT, () => console.log(`🚀 Server is running at http://localhost:${PORT}`));