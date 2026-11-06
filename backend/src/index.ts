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
import dramaRoutes from './routes/drama.routes';
import movieRoutes from './routes/movie.routes';
import userRoutes from './routes/user.routes';
import partyLandingRoutes from './routes/partyLanding.routes';
import { SocketManager } from './sockets/socketManager';
import { prisma } from './prisma';

const app = express();
const server = http.createServer(app);
// Render terminates HTTPS at its reverse proxy. Trust only the configured hop
// count so per-IP auth limits work without trusting arbitrary forwarded IPs.
app.set('trust proxy', ENV.TRUST_PROXY_HOPS);

// Security & Parsing Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN || false,
  credentials: true,
}));
// Imported DASH manifests are text and deliberately capped well below a video upload.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: 'AnnahFlix API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
app.use('/party', partyLandingRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/call', callRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/dramas', dramaRoutes);
app.use('/api/users', userRoutes);

// Error Handler
app.use(errorHandler);

// Initialize Real-time Socket.IO Gateway
app.set('roomGateway', new SocketManager(server, ENV.CORS_ORIGIN));

// Start Server
server.listen(ENV.PORT, () => {
  console.log(`🎬 AnnahFlix Backend running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  console.log(`💕 WebSocket gateway initialized`);
  console.log(`🔗 Health check: http://localhost:${ENV.PORT}/health`);
});

export { app, server };
