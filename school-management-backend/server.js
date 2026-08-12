const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app          = require('./src/app');
const connectDB    = require('./src/config/db');
const connectRedis = require('./src/config/redis');
const logger       = require('./src/config/logger');
const { initSocket } = require('./src/config/socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin:      [process.env.CLIENT_URL, 'http://localhost:3000'].filter(Boolean),
    methods:     ['GET', 'POST'],
    credentials: true,
  },
});
initSocket(io);
app.set('io', io);

// Boot
const start = async () => {
  try {
    // 1. Connect MongoDB — required
    await connectDB();
    logger.info('MongoDB connected ✓');

    // 2. Connect Redis — optional, server runs without it
    try {
      await connectRedis();
      logger.info('Redis connected ✓');
    } catch (err) {
      logger.warn(`Redis unavailable — continuing without it: ${err.message}`);
    }

    // 3. Start server
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

// Handle unhandled errors — log but don't crash
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => process.exit(0));
});

start();