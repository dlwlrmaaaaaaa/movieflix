import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import callRoutes from './routes/call.routes';
import historyRoutes from './routes/history.routes';
import { SocketManager } from './sockets/socketManager';

const app = express();
const server = http.createServer(app);

// Security & Parsing Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: 'TogetherFlix API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/call', callRoutes);
app.use('/api/history', historyRoutes);

// Error Handler
app.use(errorHandler);

// Initialize Real-time Socket.IO Gateway
new SocketManager(server, ENV.CORS_ORIGIN);

// Start Server
server.listen(ENV.PORT, () => {
  console.log(`🎬 TogetherFlix Backend running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  console.log(`💕 WebSocket gateway initialized`);
  console.log(`🔗 Health check: http://localhost:${ENV.PORT}/health`);
});

export { app, server };
