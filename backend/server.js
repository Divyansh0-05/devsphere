const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'http://localhost:3000') {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'DevSphere API running',
    status: 'ok',
  });
});

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

    app.listen(PORT, () => {
      console.log(`DevSphere API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start DevSphere API server');
    process.exit(1);
  }
};

startServer();
