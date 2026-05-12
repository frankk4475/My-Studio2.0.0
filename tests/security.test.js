const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

// App setup for testing
const app = express();
app.use(express.json());

// Mock process.env
process.env.JWT_SECRET = 'test-secret';

// Auth Middleware (from index.js) - we need this to match what we have in auth.js
// Actually, since I applied the logic INSIDE auth.js, we don't need to mock it in app level here for those routes.
app.use('/api/users', require('../routes/auth'));

let mongoServer;
let User;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  User = require('../models/User');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Security Audit - Auth Routes', () => {
  it('should NOT allow listing users without authentication', async () => {
    const res = await request(app).get('/api/users/list');
    expect(res.status).toBe(401);
  });

  it('should NOT allow deleting users without authentication', async () => {
    const user = new User({ username: 'victim', password: 'password', displayName: 'Victim' });
    await user.save();
    
    const res = await request(app).delete(`/api/users/${user._id}`);
    expect(res.status).toBe(401);
    
    const stillExists = await User.findById(user._id);
    expect(stillExists).not.toBeNull();
  });

  it('should NOT allow non-admins to list users', async () => {
    // Create an employee user
    const emp = new User({ username: 'emp', password: 'password', role: 'Employee' });
    await emp.save();
    
    const token = jwt.sign({ userId: emp._id, role: emp.role }, process.env.JWT_SECRET);
    
    const res = await request(app)
      .get('/api/users/list')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Admins only');
  });

  it('should allow Admins to list users', async () => {
    // Create an admin user
    const admin = new User({ username: 'admin', password: 'password', role: 'Admin' });
    await admin.save();
    
    const token = jwt.sign({ userId: admin._id, role: admin.role }, process.env.JWT_SECRET);
    
    const res = await request(app)
      .get('/api/users/list')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
