const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const jwt = require('jsonwebtoken');

// We need to mock the services because they might try to call real APIs
jest.mock('../services/lineService', () => ({
    customerClient: jest.fn(),
    adminClient: jest.fn(),
    config: { customerSecret: 'test-secret', customerAccessToken: 'test-token' },
    notifyAdmins: jest.fn().mockResolvedValue(true),
    sendMessage: jest.fn().mockResolvedValue(true),
    refreshConfig: jest.fn()
}));

jest.mock('../services/geminiService', () => ({
    callGemini: jest.fn().mockResolvedValue('AI Response'),
    refreshConfig: jest.fn()
}));

const User = require('../models/User');
const Booking = require('../models/Booking');
const Quote = require('../models/Quote');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

let mongoServer;
let app;
const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json({
        verify: (req, res, buf) => { req.rawBody = buf; }
    }));

    // Mock Auth Middleware
    const authMiddleware = async (req, res, next) => {
        const hdr = req.headers['authorization'] || '';
        const token = hdr.replace('Bearer ', '');
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            req.user = { userId: payload.userId, role: payload.role };
            next();
        } catch (e) {
            res.status(401).json({ message: 'Unauthorized' });
        }
    };

    // Public routes
    app.use('/api/users', require('../routes/auth'));
    app.use('/api/line', require('../routes/line'));

    // Protected routes
    app.use('/api/bookings', authMiddleware, require('../routes/bookings'));
    app.use('/api/quotes', authMiddleware, require('../routes/quotes'));
    app.use('/api/invoices', authMiddleware, require('../routes/invoices'));
    app.use('/api/customers', authMiddleware, require('../routes/customers'));
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Comprehensive System Test', () => {
    let authToken;
    let bookingId;
    let quoteId;
    let invoiceId;
    let customerId;

    test('1. System Initialization', async () => {
        // Check init
        const checkRes = await request(app).get('/api/users/check-init');
        expect(checkRes.body.initialized).toBe(false);

        // Init admin
        const initRes = await request(app)
            .post('/api/users/init')
            .send({ username: 'admin', password: 'password123', displayName: 'Admin User' });
        expect(initRes.status).toBe(201);

        const checkRes2 = await request(app).get('/api/users/check-init');
        expect(checkRes2.body.initialized).toBe(true);
    });

    test('2. Login', async () => {
        const loginRes = await request(app)
            .post('/api/users/login')
            .send({ username: 'admin', password: 'password123' });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeDefined();
        authToken = loginRes.body.token;
    });

    test('3. Booking & Customer', async () => {
        const res = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                customer: 'John Doe',
                phone: '0812345678',
                date: new Date(),
                startTime: '10:00',
                endTime: '12:00',
                bookingType: 'Wedding'
            });
        expect(res.status).toBe(201);
        bookingId = res.body._id;
    });

    test('4. Quote Creation', async () => {
        const res = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                bookingId,
                items: [{ description: 'Photography Package', quantity: 1, price: 20000 }],
                discount: 1000
            });
        expect(res.status).toBe(201);
        expect(res.body.grandTotal).toBe(19000);
        quoteId = res.body._id;
    });

    test('5. Quote Acceptance & Invoice Generation', async () => {
        const res = await request(app)
            .put(`/api/quotes/${quoteId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'Accepted' });
        
        expect(res.status).toBe(200);
        expect(res.body.createdInvoiceId).toBeDefined();
        invoiceId = res.body.createdInvoiceId;

        // Verify invoice
        const invRes = await request(app)
            .get(`/api/invoices/${invoiceId}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(invRes.body.paymentStatus).toBe('Unpaid');
        expect(invRes.body.balance).toBe(19000);
    });

    test('6. Payment Handling', async () => {
        // Partial
        const p1 = await request(app)
            .post(`/api/invoices/${invoiceId}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 5000 });
        expect(p1.body.paymentStatus).toBe('Partial');
        expect(p1.body.balance).toBe(14000);

        // Full
        const p2 = await request(app)
            .post(`/api/invoices/${invoiceId}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ amount: 14000 });
        expect(p2.body.paymentStatus).toBe('Paid');
        expect(p2.body.balance).toBe(0);
    });

    test('7. LINE Webhook (Mocked Signature)', async () => {
        const crypto = require('crypto');
        const body = { events: [{ type: 'message', message: { type: 'text', text: 'สวัสดี' }, source: { userId: 'U12345' }, replyToken: 'R123' }] };
        const signature = crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(body)).digest('base64');

        const res = await request(app)
            .post('/api/line/webhook')
            .set('x-line-signature', signature)
            .send(body);
        
        expect(res.status).toBe(200);
    });

    test('8. Send LINE Message (Corrected Route)', async () => {
        // First create a customer with lineUserId
        const cust = new Customer({ name: 'Line User', lineUserId: 'U12345' });
        await cust.save();

        const res = await request(app)
            .post('/api/customers/send-message')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ lineUserId: 'U12345', message: 'Hello from Admin' });
        
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
