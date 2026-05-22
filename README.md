# DevSphere

> A realtime collaborative cloud IDE with secure Docker-based code execution.

DevSphere is a full-stack developer platform inspired by modern cloud IDEs such as Replit and CodeSandbox. It combines collaborative project workspaces, Monaco-powered editing, Socket.IO realtime sync, Dockerized multi-language execution, role-based access control, and platform analytics into one polished SaaS-style application.

![Status](https://img.shields.io/badge/status-active-41d192)
![Stack](https://img.shields.io/badge/stack-MERN%20%2B%20Socket.IO%20%2B%20Docker-60a5fa)
![License](https://img.shields.io/badge/license-MIT-black)

---

## Overview

DevSphere was built to explore the engineering behind collaborative developer tools: realtime state synchronization, isolated code execution, multi-user permissions, project sharing, execution observability, and admin governance.

The platform lets users create coding projects, collaborate live with other users, run code safely inside Docker sandboxes, inspect execution output, and manage shared workspaces through a premium dark UI.

It is designed as both a practical coding environment and a serious distributed systems/full-stack engineering project.

---

## Key Features

### Collaborative Cloud IDE

- Monaco Editor integration with responsive layout handling
- Realtime collaborative code synchronization with Socket.IO
- Active user presence per project room
- Project sharing through collaborator invites
- Dashboard sections for owned projects and shared projects

### Secure Multi-Language Execution

- Dockerized execution sandbox
- Isolated runtime containers
- Timeout protection for runaway programs
- Compiler/runtime error handling
- Supported languages:
  - Python
  - JavaScript
  - Java
  - C++

### Project Workspace Management

- JWT authentication
- Project CRUD
- Owner/collaborator access control
- Save-before-execute workflow
- Execution history logging
- Modern responsive dashboard

### Admin & Platform Governance

- Role-based admin access
- User management
- Platform analytics
- Execution statistics
- Language usage breakdown
- Moderation-oriented admin dashboard

---

## Architecture

DevSphere is organized as a Docker Compose powered full-stack system.

```text
React Frontend
  |  REST API + Socket.IO
  v
Express Backend
  |  Mongoose
  v
MongoDB

Express Backend
  |  execution request
  v
Code Runner Service
  |  Docker Engine
  v
Isolated Execution Containers
```

### Frontend

The React frontend provides the product experience: authentication pages, workspace dashboard, Monaco project editor, realtime presence UI, share modal, terminal output, and admin analytics.

### Backend

The Express backend owns authentication, project permissions, collaborator management, execution routing, admin APIs, and Socket.IO collaboration rooms.

### Realtime Layer

Socket.IO powers transient collaboration state. REST and MongoDB remain the source of truth for persisted project data.

### Execution Layer

The code runner uses Docker to execute code in isolated containers. Source files are injected into containers using archive-based transfer rather than host bind mounts.

### Persistence

MongoDB stores users, projects, collaborator relationships, and execution logs.

---

## Realtime Collaboration Flow

1. A user opens `/projects/:id`.
2. The frontend loads the project through the REST API.
3. The client connects to Socket.IO and emits `join-project`.
4. The backend adds the socket to a project room.
5. Local code edits emit `code-change`.
6. Other users in the room receive `code-update`.
7. Active collaborators are broadcast through `active-users`.
8. On exit, the client emits `leave-project` and disconnects cleanly.

The realtime layer is intentionally transient: it synchronizes live editor state while MongoDB remains responsible for persistence.

---

## Secure Code Execution

DevSphere uses a Docker-based execution service to run untrusted code more safely than direct host execution.

Execution flow:

1. The frontend saves the current project through `PUT /api/projects/:id`.
2. The frontend calls `POST /api/projects/:id/execute`.
3. The backend verifies project access.
4. The code runner creates an isolated container.
5. Code is transferred into the container.
6. The program runs with timeout enforcement.
7. stdout, stderr, exit code, and execution time are returned.
8. Execution metadata is stored in MongoDB.

This design keeps the backend as the source of truth and avoids arbitrary direct-code execution requests from the client.

---

## Admin & Analytics

DevSphere includes a dedicated admin dashboard for platform governance, not low-level infrastructure control.

Admin capabilities include:

- View platform-wide user list
- Delete users and associated workspace data
- View total users and projects
- Track total executions
- Track executions for the current day
- Analyze language usage across executions

Admin routes are protected by JWT authentication and `req.user.role === 'admin'`.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Frontend application |
| Monaco Editor | Code editing experience |
| Socket.IO Client | Realtime collaboration |
| Axios | API communication |
| React Router | Client-side routing |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | REST API server |
| Socket.IO | Realtime collaboration server |
| MongoDB | Persistent datastore |
| Mongoose | Data modeling |
| JWT | Authentication |
| bcrypt | Password hashing |

### Infrastructure

| Technology | Purpose |
|---|---|
| Docker | Isolated code execution |
| Docker Compose | Local multi-service orchestration |
| Code Runner Service | Language execution sandbox |

---

## Screenshots

> Screenshots can be added after final UI capture.

### Login Page

![Login page screenshot placeholder](docs/screenshots/login-placeholder.png)

Premium split-screen authentication experience with DevSphere branding.

### Dashboard

![Dashboard screenshot placeholder](docs/screenshots/dashboard-placeholder.png)

Workspace dashboard with owned projects, shared projects, and project creation.

### Project Editor

![Project editor screenshot placeholder](docs/screenshots/editor-placeholder.png)

Monaco-powered collaborative IDE with active users, execution controls, and terminal output.

### Collaboration

![Collaboration screenshot placeholder](docs/screenshots/collaboration-placeholder.png)

Realtime multi-user editing with Socket.IO project rooms and presence.

### Admin Dashboard

![Admin dashboard screenshot placeholder](docs/screenshots/admin-placeholder.png)

Analytics and moderation dashboard for platform governance.

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker Desktop
- Docker Compose
- MongoDB is provided through Docker Compose

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

### 3. Start the full platform with Docker Compose

```bash
docker compose up --build
```

Services:

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:5000` |
| Code Runner | `http://localhost:8000` |
| MongoDB | `localhost:27017` |

### 4. Run frontend separately, if needed

```bash
cd frontend
npm install
npm start
```

### 5. Run backend separately, if needed

```bash
cd backend
npm install
npm start
```

---

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `MONGO_URI` | root `.env` / backend | MongoDB connection string |
| `JWT_SECRET` | root `.env` / backend | Secret used to sign JWT tokens |
| `CODE_RUNNER_URL` | root `.env` / backend | URL of the code runner service |
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

## AWS Deployment Plan

DevSphere is designed to be deployable on AWS.

Planned deployment direction:

- Frontend on S3 + CloudFront or containerized behind an Application Load Balancer
- Backend API on ECS/Fargate or EC2
- Code runner as an isolated ECS/EC2 service with Docker access
- MongoDB via MongoDB Atlas or a managed-compatible deployment
- Environment variables managed through AWS Systems Manager Parameter Store or Secrets Manager
- HTTPS termination through AWS Certificate Manager

No public production URL is included yet because deployment is planned but not currently published.

---

## Future Improvements

- Live collaborative cursors and selections
- CRDT-based conflict-free editing
- In-project chat
- AI coding assistant
- Collaborative terminal sessions
- File-tree based multi-file projects
- Deployment runners for hosted apps
- Resource quotas for execution containers
- Audit logs for admin actions
- CI/CD pipeline for AWS deployment

---

## Learning Outcomes

DevSphere demonstrates practical engineering across:

- Full-stack application design
- Realtime synchronization with Socket.IO
- Distributed system boundaries
- Secure Docker sandboxing
- JWT authentication and RBAC
- MongoDB data modeling
- Multi-service Docker orchestration
- Admin analytics and platform governance
- Responsive SaaS UI design

---

## License

MIT License.

This repository is intended as a serious engineering portfolio project and can be extended into a production-grade collaborative developer platform.
