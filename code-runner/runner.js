const express = require('express');
const Docker = require('dockerode');
const tar = require('tar-stream');
const { PassThrough } = require('stream');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PORT = 8000;
const EXECUTION_TIMEOUT_MS = 10000;
const MEMORY_LIMIT_BYTES = 256 * 1024 * 1024;
const CPU_QUOTA = 50000;

const languageConfigs = {
  python: {
    image: 'python:3.11-slim',
    filename: 'main.py',
    command: ['python', 'main.py'],
  },
  javascript: {
    image: 'node:18-alpine',
    filename: 'main.js',
    command: ['node', 'main.js'],
  },
  java: {
    image: 'eclipse-temurin:17-jdk',
    filename: 'Main.java',
    command: ['sh', '-c', 'javac Main.java && java Main'],
  },
  cpp: {
    image: 'gcc:12',
    filename: 'main.cpp',
    command: ['sh', '-c', 'g++ main.cpp -o main && ./main'],
  },
};

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const collectStream = (stream) => {
  const chunks = [];

  stream.on('data', (chunk) => {
    chunks.push(chunk);
  });

  return () => Buffer.concat(chunks).toString('utf8');
};

const waitForStreamEnd = (stream) => new Promise((resolve, reject) => {
  stream.on('end', resolve);
  stream.on('error', reject);
});

const buildTarBuffer = (filename, content) => new Promise((resolve, reject) => {
  const pack = tar.pack();
  const chunks = [];

  pack.on('data', (chunk) => {
    chunks.push(chunk);
  });

  pack.on('end', () => {
    resolve(Buffer.concat(chunks));
  });

  pack.on('error', reject);

  pack.entry({ name: 'workspace/', type: 'directory', mode: 0o755 }, (directoryError) => {
    if (directoryError) {
      reject(directoryError);
      return;
    }

    pack.entry({ name: `workspace/${filename}`, mode: 0o644 }, content, (error) => {
      if (error) {
        reject(error);
        return;
      }

      pack.finalize();
    });
  });
});

const runContainer = async ({ image, command, filename, code }) => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const getOutput = collectStream(stdout);
  const getError = collectStream(stderr);

  let container;
  let timedOut = false;
  let timeoutId;
  const startedAt = Date.now();

  try {
    container = await docker.createContainer({
      Image: image,
      Cmd: command,
      WorkingDir: '/workspace',
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      OpenStdin: false,
      NetworkDisabled: true,
      HostConfig: {
        AutoRemove: true,
        Memory: MEMORY_LIMIT_BYTES,
        CpuQuota: CPU_QUOTA,
        NetworkMode: 'none',
      },
    });

    const codeArchive = await buildTarBuffer(filename, code);
    await container.putArchive(codeArchive, { path: '/' });

    const outputStream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });
    const streamEnded = waitForStreamEnd(outputStream);

    docker.modem.demuxStream(outputStream, stdout, stderr);

    await container.start();

    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        timedOut = true;

        try {
          await container.kill();
        } catch (error) {
          if (error.statusCode !== 404 && error.statusCode !== 409) {
            console.error(`Failed to kill timed-out container: ${error.message}`);
          }
        }

        resolve({ StatusCode: 124 });
      }, EXECUTION_TIMEOUT_MS);
    });

    const result = await Promise.race([container.wait(), timeout]);
    await streamEnded.catch(() => undefined);

    const executionTime = Date.now() - startedAt;

    if (timedOut) {
      return {
        output: getOutput(),
        error: 'Execution timed out',
        exitCode: 124,
        executionTime,
      };
    }

    return {
      output: getOutput(),
      error: getError(),
      exitCode: result.StatusCode,
      executionTime,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    stdout.end();
    stderr.end();
  }
};

app.post('/execute', async (req, res) => {
  try {
    const { language, code } = req.body;
    const config = languageConfigs[language];

    if (!language || typeof language !== 'string') {
      return res.status(400).json({ message: 'Language is required' });
    }

    if (!config) {
      return res.status(400).json({ message: 'Unsupported language' });
    }

    if (typeof code !== 'string') {
      return res.status(400).json({ message: 'Code is required' });
    }

    const result = await runContainer({
      image: config.image,
      command: config.command,
      filename: config.filename,
      code,
    });

    return res.json(result);
  } catch (error) {
    console.error(`Code execution error: ${error.message}`);

    return res.status(500).json({
      output: '',
      error: 'Failed to execute code',
      exitCode: 1,
      executionTime: 0,
    });
  }
});

app.listen(PORT, () => {
  console.log(`DevSphere code-runner service running on port ${PORT}`);
});
