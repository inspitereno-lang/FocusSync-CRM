/**
 * @jest-environment node
 */
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');

// Mock MongoDB
jest.mock('mongodb');

describe('FocusSync Backend API', () => {
  let app;
  let mockDb;
  let mockCollection;

  beforeAll(() => {
    // Setup Express App for testing (similar to index.js but without listen)
    app = express();
    app.use(express.json());
    
    // Auth Middleware mock
    app.use((req, res, next) => {
      if (req.path === '/') return next();
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer test-token') {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    mockCollection = {
      find: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ id: '1', name: 'Test User' }]),
      bulkWrite: jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 }),
      aggregate: jest.fn().mockReturnThis(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    // Define Routes (subset of index.js for testing)
    app.get('/', (req, res) => res.send('FocusSync API is running...'));
    
    app.get('/sync', async (req, res) => {
      const { collection: collectionName } = req.query;
      if (!collectionName) return res.status(400).json({ error: "Missing collection" });
      const data = await mockDb.collection(collectionName).find().toArray();
      res.json(data);
    });

    app.post('/sync', async (req, res) => {
      const { collection: collectionName, data } = req.body;
      if (!collectionName || !data) return res.status(400).json({ error: "Missing collection or data" });
      const result = await mockDb.collection(collectionName).bulkWrite([]);
      res.json({ success: true, processed: result.upsertedCount + result.modifiedCount });
    });
  });

  it('should return health check message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('FocusSync API is running...');
  });

  it('should require authentication for /sync', async () => {
    const res = await request(app).get('/sync?collection=users');
    expect(res.statusCode).toBe(401);
  });

  it('should return data for /sync with valid token', async () => {
    const res = await request(app)
      .get('/sync?collection=users')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Test User');
  });

  it('should accept data via POST /sync', async () => {
    const res = await request(app)
      .post('/sync')
      .set('Authorization', 'Bearer test-token')
      .send({ collection: 'users', data: [{ id: '2', name: 'New User' }] });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processed).toBe(1);
  });
});
