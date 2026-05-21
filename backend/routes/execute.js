const express = require('express');
const axios = require('axios');
const protect = require('../middleware/auth');
const Project = require('../models/Project');
const ExecutionLog = require('../models/ExecutionLog');
const { isValidObjectId, isOwnerOrCollaborator } = require('../utils/projectAccess');

const router = express.Router();

router.use(protect);

const CODE_RUNNER_TIMEOUT_MS = 15000;

const getCodeRunnerBaseUrl = () => {
  const url = process.env.CODE_RUNNER_URL;

  if (!url) {
    return null;
  }

  return url.replace(/\/$/, '');
};

const loadAccessibleProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);

  if (!project) {
    return { status: 404, message: 'Project not found' };
  }

  if (!isOwnerOrCollaborator(project, userId)) {
    return { status: 403, message: 'Not authorized to access this project' };
  }

  return { project };
};

const handleCodeRunnerError = (error, res) => {
  if (error.code === 'ECONNABORTED') {
    return res.status(504).json({ message: 'Code runner request timed out' });
  }

  if (error.response) {
    const { output = '', error: runnerError = '', exitCode = 1, executionTime = 0 } = error.response.data || {};

    return res.status(error.response.status).json({
      message: 'Code runner returned an error',
      output,
      error: runnerError,
      exitCode,
      executionTime,
    });
  }

  return res.status(503).json({ message: 'Code runner service is unavailable' });
};

router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const access = await loadAccessibleProject(id, req.user._id);

    if (access.status) {
      return res.status(access.status).json({ message: access.message });
    }

    const { project } = access;
    const codeRunnerUrl = getCodeRunnerBaseUrl();

    if (!codeRunnerUrl) {
      return res.status(500).json({ message: 'Code runner URL is not configured' });
    }

    const { language, code } = project;

    let runnerResult;

    try {
      const response = await axios.post(
        `${codeRunnerUrl}/execute`,
        { language, code },
        { timeout: CODE_RUNNER_TIMEOUT_MS },
      );

      runnerResult = response.data;
    } catch (error) {
      return handleCodeRunnerError(error, res);
    }

    const {
      output = '',
      error: runnerError = '',
      exitCode = 0,
      executionTime = 0,
    } = runnerResult;

    const log = await ExecutionLog.create({
      project: project._id,
      user: req.user._id,
      language,
      code,
      output,
      error: runnerError,
      exitCode,
      executionTime,
    });

    return res.status(200).json({
      output,
      error: runnerError,
      exitCode,
      executionTime,
      logId: log._id,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const access = await loadAccessibleProject(id, req.user._id);

    if (access.status) {
      return res.status(access.status).json({ message: access.message });
    }

    const logs = await ExecutionLog.find({ project: id })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
