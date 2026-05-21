/**
 * Real-time collaboration state and Socket.IO event handlers.
 *
 * roomUsers: Map<projectId, Map<socketId, { socketId, username }>>
 * socketRooms: Map<socketId, Set<projectId>>
 */

const roomUsers = new Map();
const socketRooms = new Map();

const getRoom = (projectId) => {
  if (!roomUsers.has(projectId)) {
    roomUsers.set(projectId, new Map());
  }

  return roomUsers.get(projectId);
};

const getActiveUsers = (projectId) => {
  const room = roomUsers.get(projectId);

  if (!room) {
    return [];
  }

  return Array.from(room.values());
};

const emitActiveUsers = (io, projectId) => {
  io.to(projectId).emit('active-users', getActiveUsers(projectId));
};

const cleanupEmptyRoom = (projectId) => {
  const room = roomUsers.get(projectId);

  if (room && room.size === 0) {
    roomUsers.delete(projectId);
  }
};

const trackSocketRoom = (socketId, projectId) => {
  if (!socketRooms.has(socketId)) {
    socketRooms.set(socketId, new Set());
  }

  socketRooms.get(socketId).add(projectId);
};

const untrackSocketRoom = (socketId, projectId) => {
  const projects = socketRooms.get(socketId);

  if (!projects) {
    return;
  }

  projects.delete(projectId);

  if (projects.size === 0) {
    socketRooms.delete(socketId);
  }
};

const removeUserFromRoom = (io, socket, projectId) => {
  const room = roomUsers.get(projectId);

  if (!room) {
    return null;
  }

  const user = room.get(socket.id);

  if (!user) {
    return null;
  }

  room.delete(socket.id);
  cleanupEmptyRoom(projectId);
  untrackSocketRoom(socket.id, projectId);

  return user;
};

const leaveAllRooms = (io, socket) => {
  const projectIds = socketRooms.get(socket.id);

  if (!projectIds) {
    return;
  }

  const roomsToLeave = Array.from(projectIds);

  roomsToLeave.forEach((projectId) => {
    const user = removeUserFromRoom(io, socket, projectId);

    if (user) {
      socket.leave(projectId);
      socket.to(projectId).emit('user-left', {
        socketId: socket.id,
        username: user.username,
      });
      emitActiveUsers(io, projectId);
    }
  });
};

const registerCollaborationHandlers = (io) => {
  console.log('Socket.IO collaboration handlers registered');

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (transport: ${socket.conn.transport.name})`);

    socket.conn.on('upgrade', (transport) => {
      console.log(`Socket upgraded: ${socket.id} -> ${transport.name}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error (${socket.id}):`, error.message);
    });

    socket.on('join-project', ({ projectId, username }) => {
      if (!projectId || !username) {
        return;
      }

      const existingRooms = socketRooms.get(socket.id);

      if (existingRooms) {
        Array.from(existingRooms).forEach((joinedProjectId) => {
          if (joinedProjectId !== projectId) {
            const user = removeUserFromRoom(io, socket, joinedProjectId);

            if (user) {
              socket.leave(joinedProjectId);
              socket.to(joinedProjectId).emit('user-left', {
                socketId: socket.id,
                username: user.username,
              });
              emitActiveUsers(io, joinedProjectId);
            }
          }
        });
      }

      const room = getRoom(projectId);

      if (room.has(socket.id)) {
        room.set(socket.id, { socketId: socket.id, username });
        emitActiveUsers(io, projectId);
        return;
      }

      socket.join(projectId);
      room.set(socket.id, { socketId: socket.id, username });
      trackSocketRoom(socket.id, projectId);

      socket.to(projectId).emit('user-joined', {
        socketId: socket.id,
        username,
      });

      emitActiveUsers(io, projectId);
    });

    socket.on('code-change', ({ projectId, code, cursor }) => {
      if (!projectId) {
        return;
      }

      const room = roomUsers.get(projectId);
      const user = room?.get(socket.id);

      if (!user) {
        return;
      }

      socket.to(projectId).emit('code-update', {
        code,
        cursor,
        username: user.username,
      });
    });

    socket.on('leave-project', ({ projectId }) => {
      if (!projectId) {
        return;
      }

      const user = removeUserFromRoom(io, socket, projectId);

      if (!user) {
        return;
      }

      socket.leave(projectId);

      socket.to(projectId).emit('user-left', {
        socketId: socket.id,
        username: user.username,
      });

      emitActiveUsers(io, projectId);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      leaveAllRooms(io, socket);
    });
  });
};

module.exports = {
  registerCollaborationHandlers,
  roomUsers,
  socketRooms,
};
