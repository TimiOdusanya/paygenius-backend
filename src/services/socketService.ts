import http from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import logger from '../lib/log/winston.log';

let io: Server | null = null;

function readSocketToken(socket: { handshake: { auth?: Record<string, any>; headers: Record<string, any> } }) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.replace(/^Bearer\s+/i, '').trim();
  }

  const header = socket.handshake.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/^Bearer\s+/i, '').trim();
  }

  return '';
}

export function initSocket(httpServer: http.Server) {
  io = new Server(httpServer, {
    cors: { origin: true },
  });

  io.on('connection', (socket) => {
    try {
      const token = readSocketToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }

      const decoded = verifyToken(token);
      const userId = decoded.userId;
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      socket.join(`user:${userId}`);
      logger.info(`Socket connected for user ${userId}`);
    } catch (error) {
      logger.warn('Socket authentication failed', error);
      socket.disconnect(true);
    }
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function getIO() {
  return io;
}
