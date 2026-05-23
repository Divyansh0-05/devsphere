const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { registerCollaborationHandlers } = require('./socket/collaboration');

dotenv.config({ path: path.join(__dirname, '../.env') });

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const projectsRouter = require('./routes/projects');
const executeRouter = require('./routes/execute');

const app = express();
const server = http.createServer(app);

const SOCKET_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://16.171.162.80:3000',
];

const isSocketOriginAllowed = (origin) => {
  if (!origin || origin === 'null') {
    return true;
  }

  return SOCKET_CORS_ORIGINS.includes(origin);
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isSocketOriginAllowed(origin)) {
        return callback(null, true);
      }

      console.warn(`Socket.IO CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'http://localhost:3000' || isSocketOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', executeRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'DevSphere API running',
    status: 'ok',
    socketIO: true,
  });
});

io.engine.on('connection_error', (error) => {
  console.error('Socket.IO connection error:', error.message);
});

registerCollaborationHandlers(io);

const connectToDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const startServer = async () => {
  try {
    await connectToDatabase();

    server.listen(PORT, HOST, () => {
      console.log(`DevSphere API server running on http://${HOST}:${PORT}`);
      console.log('Socket.IO collaboration enabled');
      console.log(`Socket.IO test page: http://localhost:${PORT}/socket-test.html`);
    });
  } catch (error) {
    console.error('Failed to start DevSphere API server');
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
