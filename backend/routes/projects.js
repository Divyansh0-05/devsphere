const express = require('express');
const mongoose = require('mongoose');
const protect = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');

const router = express.Router();

router.use(protect);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOwnerId = (owner) => (owner._id ? owner._id : owner).toString();

const isOwnerOrCollaborator = (project, userId) => {
  const userIdStr = userId.toString();

  if (getOwnerId(project.owner) === userIdStr) {
    return true;
  }

  return project.collaborators.some((collab) => {
    const collabId = collab._id ? collab._id : collab;
    return collabId.toString() === userIdStr;
  });
};

const isOwner = (project, userId) => getOwnerId(project.owner) === userId.toString();

const populateUsers = (query) => query
  .populate('owner', 'username email')
  .populate('collaborators', 'username email');

router.post('/', async (req, res) => {
  try {
    const { name, description, language } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description || '',
      language: language || 'python',
      owner: req.user._id,
      code: '',
    });

    return res.status(201).json(project);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { collaborators: req.user._id },
      ],
    }).sort({ updatedAt: -1 });

    return res.status(200).json(projects);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = await populateUsers(Project.findById(id));

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!isOwnerOrCollaborator(project, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this project' });
    }

    return res.status(200).json(project);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!isOwnerOrCollaborator(project, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    const { code, name, description, language } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        message: 'Project name cannot be empty',
      });
    }

    const updates = { updatedAt: new Date() };

    if (code !== undefined) updates.code = code;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (language !== undefined) updates.language = language;

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true },
    );

    return res.status(200).json(updatedProject);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({ message: 'Only the project owner can delete this project' });
    }

    await Project.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/collaborators', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({
        message: 'Only the project owner can manage collaborators',
      });
    }

    const collaborator = await User.findOne({ email: email.trim().toLowerCase() });

    if (!collaborator) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (project.owner.toString() === collaborator._id.toString()) {
      return res.status(400).json({ message: 'Project owner cannot be added as a collaborator' });
    }

    const isDuplicate = project.collaborators.some(
      (collabId) => collabId.toString() === collaborator._id.toString(),
    );

    if (isDuplicate) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    project.collaborators.push(collaborator._id);
    project.updatedAt = new Date();
    await project.save();

    const updatedProject = await populateUsers(Project.findById(id));

    return res.status(200).json(updatedProject);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
