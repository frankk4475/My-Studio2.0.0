const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

// Simple app setup for testing
const app = express();
app.use(express.json());

// Mock Auth Middleware
const authMiddleware = (req, res, next) => {
  req.user = { userId: 'test-user-id' };
  next();
};

// Mount routes
app.use('/api/bookings', authMiddleware, require('../routes/bookings'));
app.use('/api/quotes', authMiddleware, require('../routes/quotes'));
app.use('/api/invoices', authMiddleware, require('../routes/invoices'));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('API Endpoints', () => {
  let bookingId;

  test('POST /api/bookings - should create a new booking', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        customer: 'Test Customer',
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        bookingType: 'Portrait'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.customer).toBe('Test Customer');
    bookingId = res.body._id;
  });

  test('GET /api/bookings - should list bookings', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/quotes - should create a quote for a booking', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .send({
        bookingId,
        items: [{ description: 'Session Fee', quantity: 1, price: 5000 }],
        discount: 500
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(5000);
    expect(res.body.grandTotal).toBe(4500);
  });

  test('POST /api/invoices/:id/payment - should handle partial and full payments', async () => {
    // Create an invoice first via quote acceptance
    const quoteRes = await request(app)
      .post('/api/quotes')
      .send({
        bookingId,
        items: [{ description: 'Test Item', quantity: 1, price: 1000 }]
      });
    const quoteId = quoteRes.body._id;
    
    const acceptRes = await request(app)
      .put(`/api/quotes/${quoteId}`)
      .send({ status: 'Accepted' });
    
    const invoiceId = acceptRes.body.createdInvoiceId;

    // 1. Partial Payment
    const partialRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payment`)
      .send({ amount: 400 });
    
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.amountPaid).toBe(400);
    expect(partialRes.body.paymentStatus).toBe('Partial');
    expect(partialRes.body.balance).toBe(600);

    // 2. Full Payment
    const fullRes = await request(app)
      .post(`/api/invoices/${invoiceId}/payment`)
      .send({ amount: 600 });
    
    expect(fullRes.status).toBe(200);
    expect(fullRes.body.paymentStatus).toBe('Paid');
    expect(fullRes.body.balance).toBe(0);
  });
});
