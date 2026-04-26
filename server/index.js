const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-sync-source");
  res.header("Access-Control-Allow-Credentials", "true");
  
  if (req.method === "OPTIONS") {
    return res.status(200).send();
  }

  if (req.path !== '/') {
    const authHeader = req.headers.authorization;
    const token = process.env.AUTH_TOKEN || "focussync-secure-prod-token-2026";
    if (!authHeader || authHeader !== `Bearer ${token}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  next();
});
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('focussync');
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}

connectDB();

// Health Check
app.get('/', (req, res) => {
  res.send('FocusSync API is running...');
});

// Sync Endpoint (GET - Pulls data from cloud)
app.get('/sync', async (req, res) => {
  const { collection: collectionName } = req.query;
  
  if (!collectionName) {
    return res.status(400).json({ error: "Missing collection" });
  }

  try {
    const collection = db.collection(collectionName);
    const data = await collection.find({}).toArray();
    res.json(data);
  } catch (err) {
    console.error(`Pull Error (${collectionName}):`, err);
    res.status(500).json({ error: err.message });
  }
});

// Sync Endpoint (POST - Receives data from Tauri apps)
app.post('/sync', async (req, res) => {
  const { collection: collectionName, data } = req.body;
  
  if (!collectionName || !data) {
    return res.status(400).json({ error: "Missing collection or data" });
  }

  try {
    const collection = db.collection(collectionName);
    
    // Upsert data
    const operations = data.map(item => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: { ...item, synced: 1, last_cloud_sync: new Date() } },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(operations);
    res.json({ success: true, processed: result.upsertedCount + result.modifiedCount });
  } catch (err) {
    console.error(`Sync Error (${collectionName}):`, err);
    res.status(500).json({ error: err.message });
  }
});

// Admin View: Active Sessions
app.get('/active-sessions', async (req, res) => {
  try {
    const sessions = await db.collection('sessions').aggregate([
      { $match: { logout_time: null, last_ping: { $gt: new Date(Date.now() - 5 * 60 * 1000).toISOString() } } },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: 'id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', email: '$user.email', role: '$user.role', login_time: 1, last_ping: 1 } }
    ]).toArray();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin View: Proctoring Alerts
app.get('/proctoring-alerts', async (req, res) => {
  try {
    const alerts = await db.collection('proctoring_events')
      .find()
      .sort({ start_time: -1 })
      .limit(20)
      .toArray();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin View: Tasks
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await db.collection('tasks').find({ is_deleted: { $ne: 1 } }).sort({ id: -1 }).toArray();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin View: Users
app.get('/users', async (req, res) => {
  try {
    const users = await db.collection('users').find({ is_deleted: { $ne: 1 } }).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Direct Management Endpoints
app.post('/users/manage', async (req, res) => {
  const { action, user } = req.body;
  try {
    const collection = db.collection('users');
    if (action === 'delete') {
      await collection.updateOne({ id: user.id }, { $set: { is_deleted: 1, updated_at: new Date() } });
    } else {
      await collection.updateOne({ id: user.id }, { $set: { ...user, updated_at: new Date() } }, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tasks/manage', async (req, res) => {
  const { action, task } = req.body;
  try {
    const collection = db.collection('tasks');
    if (action === 'delete') {
      await collection.updateOne({ id: task.id }, { $set: { is_deleted: 1, updated_at: new Date() } });
    } else {
      await collection.updateOne({ id: task.id }, { $set: { ...task, updated_at: new Date() } }, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
