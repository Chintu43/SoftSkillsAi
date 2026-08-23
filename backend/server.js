import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { setupRoomSockets } from './sockets/roomHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SkillForge AI Backend', timestamp: new Date() });
});

// Universal Express JSON Error Handler (Prevents HTML Error Pages)
app.use((err, req, res, next) => {
  console.error('Unhandled express error:', err);
  res.status(500).json({ valid: false, message: err.message || 'Internal server error' });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupRoomSockets(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 SkillForge AI Backend Server running on http://localhost:${PORT}`);
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    console.log('✅ Gemini API configured successfully');
  } else {
    console.warn('⚠️ Gemini API key missing (GEMINI_API_KEY is not set in .env)');
  }
});
