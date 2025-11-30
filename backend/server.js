import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS middleware - Express 5 compatible
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3006', 'http://127.0.0.1:3006'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

// Test route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Test database route
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected!', time: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});