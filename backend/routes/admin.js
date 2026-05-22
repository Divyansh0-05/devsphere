const express = require('express');
const mongoose = require('mongoose');
const protect = require('../middleware/auth');
const ExecutionLog = require('../models/ExecutionLog');
const Project = require('../models/Project');
const User = require('../models/User');

const router = express.Router();

router.use(protect);

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
};

router.use(requireAdmin);

router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('username email role createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'Admins cannot delete their own account' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const ownedProjects = await Project.find({ owner: id }).select('_id');
    const ownedProjectIds = ownedProjects.map((project) => project._id);

    await ExecutionLog.deleteMany({
      $or: [
        { user: id },
        { project: { $in: ownedProjectIds } },
      ],
    });
    await Project.deleteMany({ owner: id });
    await Project.updateMany(
      { collaborators: id },
      { $pull: { collaborators: id } },
    );
    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: 'User and owned workspace data deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalExecutions,
      todayExecutions,
      languageBreakdown,
      totalUsers,
      totalProjects,
    ] = await Promise.all([
      ExecutionLog.countDocuments(),
      ExecutionLog.countDocuments({ createdAt: { $gte: startOfToday } }),
      ExecutionLog.aggregate([
        {
          $group: {
            _id: '$language',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        {
          $project: {
            _id: 0,
            language: '$_id',
            count: 1,
          },
        },
      ]),
      User.countDocuments(),
      Project.countDocuments(),
    ]);

    return res.status(200).json({
      totalExecutions,
      todayExecutions,
      languageBreakdown,
      totalUsers,
      totalProjects,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
