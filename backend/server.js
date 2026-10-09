// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend origins: local dev, production and anything in FRONTEND_URL
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3006',
  'http://127.0.0.1:3006',
  'https://theopeninvitational.vercel.app',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()) : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow tools with no origin (curl, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow Vercel preview deployments of this project
    if (/^https:\/\/theopeninvitational[a-z0-9-]*\.vercel\.app$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

// Health check (also used to wake the server)
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Database check
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected!', time: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warn loudly about missing config instead of failing silently later
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
requiredEnv.forEach((key) => {
  if (!process.env[key]) console.error(`❌ Missing required env var: ${key}`);
});
if (!process.env.FRONTEND_URL) {
  console.warn('⚠️  FRONTEND_URL not set. Invite and reset emails will link to localhost.');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});