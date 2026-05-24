# DevSphere

> Realtime collaborative coding platform with Docker-based multi-language execution.

DevSphere is a full-stack cloud IDE project built with React, Node.js, Socket.IO, MongoDB, and Docker. It supports authenticated project workspaces, realtime collaborative editing, project sharing, sandboxed code execution, execution history, and an admin dashboard for platform-level monitoring.

![Status](https://img.shields.io/badge/status-deployed-41d192)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20Socket.IO%20%2B%20Docker-60a5fa)
![License](https://img.shields.io/badge/license-MIT-black)

---

## Live Deployment

DevSphere is deployed publicly on an AWS EC2 Ubuntu instance using Docker Compose.

| Service | Public URL |
|---|---|
| Frontend | `http://16.171.162.80:3000` |
| Backend API | `http://16.171.162.80:5000` |

Deployment notes:

- Backend, MongoDB, and code-runner services run through Docker Compose.
- The frontend is built with `npm run build` and served as a static React build using `serve -s build`.
- This replaced the CRA development server in production because the dev server caused unnecessary memory pressure on a small EC2 instance.
- Socket.IO CORS configuration was updated to support the EC2 public-IP deployment instead of localhost-only development.

---

## Overview

DevSphere was built to understand the core engineering problems behind collaborative developer platforms:

- synchronizing editor state between multiple users,
- executing untrusted code in isolated environments,
- managing project ownership and collaborators,
- collecting execution analytics,
- and deploying a multi-container application on a constrained cloud instance.

The project is intentionally scoped as a single-node collaborative IDE rather than a large distributed platform. The focus is on practical engineering decisions, reliable demos, and clear system boundaries.

---

## Why DevSphere Was Built

Most coding platforms hide a lot of difficult infrastructure behind a simple editor. DevSphere was built to expose and implement those underlying systems:

- How does a browser editor sync code changes in realtime?
- How should project permissions work when users share workspaces?
- How can code be executed without running directly on the backend host?
- How do WebSockets behave differently after moving from localhost to a public cloud IP?
- What changes are needed when deploying a full Docker Compose stack to a small EC2 instance?

The result is a working end-to-end platform that demonstrates product thinking and backend systems engineering together.

---

## Key Features

### Collaborative Workspace

- Monaco Editor integration
- Realtime Socket.IO code synchronization
- Active user presence per project
- Project sharing through collaborator invites
- Separate dashboard sections for owned and shared projects
- Responsive dark SaaS-style UI

### Secure Code Execution

- Docker-based execution service
- Python, JavaScript, Java, and C++ support
- Timeout enforcement
- Memory limits
- CPU quota
- Network-disabled execution containers
- Auto-removed execution containers
- Compiler/runtime error handling
- Execution history stored in MongoDB

### Authentication & Access Control

- JWT authentication
- Password hashing with bcrypt
- Project owner/collaborator permissions
- Role-based admin access
- Protected admin APIs

### Admin & Analytics

- Platform overview dashboard
- User management
- Total users and projects
- Total executions and today's executions
- Language usage breakdown
- Moderation-oriented user deletion flow

---

## Architecture

DevSphere uses a multi-container Docker Compose architecture.

```text
Browser
  | HTTP + Socket.IO
  v
React Frontend
  | REST API + WebSocket
  v
Express Backend
  | Mongoose
  v
MongoDB

Express Backend
  | HTTP execution request
  v
Code Runner Service
  | Docker socket
  v
Isolated Language Runtime Containers
```

### Frontend

The React frontend handles authentication screens, dashboard, project editor, collaboration UI, terminal output, sharing modal, and admin dashboard.

For production deployment on EC2, the frontend is built once:

```bash
npm run build
```

and served statically:

```bash
serve -s build
```

This reduced memory usage compared with running the CRA development server on the EC2 instance.

### Backend

The Express backend owns:

- authentication,
- project CRUD,
- collaborator permissions,
- execution routing,
- execution history,
- admin APIs,
- and Socket.IO room management.

### Realtime Layer

Socket.IO is used for transient collaboration state:

- joining project rooms,
- broadcasting code changes,
- tracking active users,
- and cleaning up presence on disconnect.

REST + MongoDB remain the source of truth for persisted project state.

### Code Runner

The code-runner service receives execution requests from the backend and starts short-lived Docker containers for each run.

It currently uses these runtime images:

| Language | Docker image |
|---|---|
| Python | `python:3.11-slim` |
| JavaScript | `node:18-alpine` |
| Java | `eclipse-temurin:17-jdk` |
| C++ | `gcc:12` |

The Java image was updated to `eclipse-temurin:17-jdk` for better compatibility with compilation and runtime behavior in the execution container.

---

## Realtime Collaboration Flow

1. A user opens `/projects/:id`.
2. The frontend loads project data through the REST API.
3. The client connects to Socket.IO.
4. The client emits `join-project` with the project ID and username.
5. The backend adds the socket to a project room.
6. Local code edits emit `code-change`.
7. Other users receive `code-update`.
8. The UI updates active collaborators from `active-users`.
9. On unmount, the client emits `leave-project` and disconnects cleanly.

The frontend avoids infinite update loops by only applying incoming code when it differs from the current editor state.

---

## Secure Code Execution

DevSphere intentionally avoids running submitted code directly inside the backend process.

For each execution, the code-runner creates an isolated Docker container with:

- `NetworkDisabled: true`
- `NetworkMode: none`
- memory limit
- CPU quota
- timeout enforcement
- stdout/stderr capture
- automatic container removal

Source code is injected into the container using Docker's `putArchive()` API. Bind mounts are intentionally avoided because they are fragile across host/container boundaries and become especially problematic when the runner itself is containerized and controlling the host Docker daemon through the Docker socket.

Execution flow:

1. The frontend saves the current project through `PUT /api/projects/:id`.
2. The frontend calls `POST /api/projects/:id/execute`.
3. The backend validates project access.
4. The backend forwards the saved project code to the code-runner.
5. The runner creates a language-specific Docker container.
6. Code is injected with `putArchive()`.
7. The program runs with resource limits and timeout protection.
8. stdout, stderr, exit code, and execution time are returned.
9. Execution metadata is stored in MongoDB.

---

## Key Engineering Decisions

| Decision | Reason |
|---|---|
| REST for persistence, Socket.IO for realtime state | Keeps saved project data authoritative while allowing fast live collaboration |
| Save before execute | Prevents arbitrary unsaved code from being sent directly to execution endpoints |
| `putArchive()` instead of bind mounts | More reliable for nested container execution and cloud deployment |
| Docker socket access from code-runner | Allows the runner service to create sibling execution containers |
| Static frontend serving in production | Reduces memory pressure compared with CRA dev server |
| Explicit Socket.IO CORS configuration | Required for public EC2 IP deployment |
| `eclipse-temurin:17-jdk` for Java | Provides a complete Java 17 JDK image suitable for compilation |

---

## Engineering Challenges Solved

- Realtime Socket.IO synchronization
- Docker sandbox execution
- Secure isolated runtime execution
- Cross-platform container file injection using `putArchive()`
- Multi-container orchestration with Docker Compose
- WebSocket deployment debugging on a public EC2 IP
- Socket.IO CORS changes between localhost and cloud deployment
- Resource-constrained AWS deployment debugging
- Replacing development frontend serving with static production serving
- Java runtime image compatibility issues

---

## Admin & Analytics

The admin dashboard is designed for platform governance rather than infrastructure control.

Admin capabilities:

- View all users
- Delete users and associated owned workspace data
- View total users
- View total projects
- View total executions
- View executions for the current day
- View language usage analytics

Admin APIs are protected by JWT authentication and an explicit role check:

```js
req.user.role === 'admin'
```

---

## Production Considerations

The deployed version runs on a single AWS EC2 Ubuntu instance. This is suitable for demos and low-to-medium usage, but it is not intended to be a horizontally scalable production architecture yet.

Important production considerations:

- Code execution is resource-intensive.
- Java and C++ runtime images are large and can pressure disk/memory.
- MongoDB currently runs as part of the Compose stack.
- The code-runner controls the Docker daemon through the Docker socket.
- WebSocket CORS must explicitly allow the deployed frontend origin.
- Static frontend serving is much more stable than CRA dev server on small instances.

---

## Deployment Lessons Learned

- The CRA development server consumed too much memory for a small EC2 instance.
- Building the frontend with `npm run build` and serving it with `serve -s build` improved memory stability on `t3.micro`.
- Socket.IO worked locally but required CORS updates for public-IP deployment.
- Java execution required a compatible JDK image; `eclipse-temurin:17-jdk` worked reliably.
- `putArchive()` was more reliable than bind mounts for containerized runner execution.
- Small cloud instances need careful image, memory, and process management.

---

## Current Limitations

DevSphere is functional, but the current version has deliberate limits:

- Single-node deployment
- No CRDT-based conflict resolution yet
- Basic sandbox resource isolation
- MongoDB authentication hardening still pending
- Optimized for low-to-medium concurrent usage
- No horizontal scaling for Socket.IO rooms yet
- No centralized logging/metrics pipeline yet
- No production domain or HTTPS termination yet

These are known engineering boundaries rather than hidden assumptions.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Frontend application |
| Monaco Editor | Code editor |
| Socket.IO Client | Realtime collaboration |
| Axios | API communication |
| React Router | Client-side routing |
| serve | Static production frontend serving |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | REST API |
| Socket.IO | Realtime collaboration |
| MongoDB | Persistence |
| Mongoose | Data modeling |
| JWT | Authentication |
| bcrypt | Password hashing |

### Infrastructure

| Technology | Purpose |
|---|---|
| Docker | Runtime isolation and service packaging |
| Docker Compose | Multi-container orchestration |
| AWS EC2 Ubuntu | Public deployment host |
| Docker socket | Allows code-runner to start execution containers |

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker Desktop
- Docker Compose

### 1. Clone the repository

```bash
git clone <repository-url>
cd devsphere
```

### 2. Configure environment variables

Create a root `.env` file:

```env
MONGO_URI=mongodb://mongodb:27017/devsphere
JWT_SECRET=replace_with_a_strong_secret
CODE_RUNNER_URL=http://code-runner:8000
```

For local frontend development, optionally create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000
```

### 3. Start the Docker Compose stack

```bash
docker compose up --build
```

Local services:

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:5000` |
| Code Runner | `http://localhost:8000` |
| MongoDB | `localhost:27017` |

### 4. Build and serve frontend for production-style testing

```bash
cd frontend
npm install
npm run build
npx serve -s build
```

---

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `MONGO_URI` | root `.env` / backend | MongoDB connection string |
| `JWT_SECRET` | root `.env` / backend | Secret used to sign JWT tokens |
| `CODE_RUNNER_URL` | root `.env` / backend | URL of the code-runner service |
| `REACT_APP_API_URL` | `frontend/.env` | Frontend API base URL |

---

## Project Structure

```text
devsphere/
|-- backend/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   |-- socket/
|   |-- utils/
|   |-- Dockerfile
|   `-- server.js
|-- code-runner/
|   |-- Dockerfile
|   |-- package.json
|   `-- runner.js
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   `-- pages/
|   |-- Dockerfile
|   `-- package.json
|-- docker-compose.yml
`-- README.md
```

---

## Future Improvements

- Live cursors and text selections
- CRDT-based collaborative editing
- In-project chat
- AI coding assistant
- Collaborative terminal sessions
- Multi-file project workspaces
- Deployment runners for hosted apps
- Stronger sandboxing with stricter runtime policies
- MongoDB authentication and production hardening
- HTTPS + domain configuration
- Centralized logs and metrics
- Horizontal scaling for Socket.IO

---

## Learning Outcomes

DevSphere demonstrates:

- Realtime application design with Socket.IO
- Docker-based code execution
- Runtime resource isolation
- JWT authentication and RBAC
- MongoDB data modeling
- Multi-container orchestration
- Cloud deployment debugging
- WebSocket/CORS production issues
- Practical frontend production serving
- Admin analytics and moderation workflows

---

## License

MIT License.

DevSphere is a working engineering portfolio project that can be extended toward a production-grade collaborative developer platform.
