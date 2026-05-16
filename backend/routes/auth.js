const express = require('express');
const jwt = require('jsonwebtoken');
const protect = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const createToken = (userId) => jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: '7d' },
);

const toSafeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password,
    });

    const token = createToken(user._id);

    return res.status(201).json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with those credentials already exists' });
    }

    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken(user._id);

    return res.status(200).json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    return res.status(200).json({ user: req.user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
