import { Store } from '../services/store.js';
import { checkGroupContentSafety } from '../services/geminiService.js';

const userViolations = new Map();

export const setupRoomSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join room event
    socket.on('join-room', async ({ roomId, user }) => {
      try {
        if (!roomId || !user || (!user.id && !user._id)) return;
        const userId = user.id || user._id;
        const userName = user.name || 'Participant';
        const normalizedRoomId = roomId.toUpperCase();

        const room = await Store.findRoomById(normalizedRoomId);
        if (!room) {
          socket.emit('error-message', 'Room not found.');
          return;
        }

        const maxLimit = room.maxMembers || 4;
        const participants = Array.isArray(room.participants) ? room.participants : [];
        const existingParticipant = participants.find(p => p.userId && p.userId.toString() === userId.toString());
        
        if (!existingParticipant && participants.length >= maxLimit) {
          socket.emit('error-message', `⚠️ Room is full. Maximum ${maxLimit} participants allowed.`);
          return;
        }

        socket.join(normalizedRoomId);
        socket.roomId = normalizedRoomId;
        socket.userId = userId;
        socket.userName = userName;

        userViolations.set(`${normalizedRoomId}:${userId}`, 0);

        await Store.updateRoom(normalizedRoomId, (roomDoc) => {
          if (!Array.isArray(roomDoc.participants)) roomDoc.participants = [];
          const p = roomDoc.participants.find(part => part.userId && part.userId.toString() === userId.toString());
          if (p) {
            p.socketId = socket.id;
          } else if (roomDoc.participants.length < maxLimit) {
            roomDoc.participants.push({
              userId: userId,
              userName: userName,
              socketId: socket.id,
              joinedAt: new Date().toISOString()
            });
          }
        });

        const updatedRoom = await Store.findRoomById(normalizedRoomId);

        io.to(normalizedRoomId).emit('room-updated', updatedRoom);
        socket.to(normalizedRoomId).emit('user-joined', {
          socketId: socket.id,
          userId: userId,
          userName: userName
        });

        console.log(`👤 User ${userName} joined room ${normalizedRoomId}`);
      } catch (err) {
        console.error('Socket join-room error:', err);
      }
    });

    // WebRTC Signaling: Offer
    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      if (targetSocketId && offer) {
        io.to(targetSocketId).emit('webrtc-offer', {
          senderSocketId: socket.id,
          senderUserId: socket.userId,
          senderUserName: socket.userName,
          offer
        });
      }
    });

    // WebRTC Signaling: Answer
    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      if (targetSocketId && answer) {
        io.to(targetSocketId).emit('webrtc-answer', {
          senderSocketId: socket.id,
          answer
        });
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      if (targetSocketId && candidate) {
        io.to(targetSocketId).emit('webrtc-ice-candidate', {
          senderSocketId: socket.id,
          candidate
        });
      }
    });

    // Real-time transcript & off-topic AI monitoring
    socket.on('speech-transcript', async ({ roomId, transcript, topic }) => {
      if (!roomId || !transcript || !socket.userId) return;
      const normalizedRoomId = roomId.toUpperCase();

      socket.to(normalizedRoomId).emit('participant-transcript', {
        userId: socket.userId,
        userName: socket.userName,
        transcript
      });

      const safetyResult = await checkGroupContentSafety(transcript, topic);
      if (safetyResult.isViolation) {
        const key = `${normalizedRoomId}:${socket.userId}`;
        const currentViolations = (userViolations.get(key) || 0) + 1;
        userViolations.set(key, currentViolations);

        if (currentViolations === 1) {
          socket.emit('ai-warning', {
            warningCount: 1,
            message: safetyResult.warningMessage || 'Please stay focused on the discussion topic and maintain professional language.'
          });
        } else if (currentViolations >= 2) {
          socket.emit('session-terminated-violation', {
            message: 'Your session has been ended because of repeated violations of the discussion guidelines.'
          });

          socket.to(normalizedRoomId).emit('participant-ejected', {
            userId: socket.userId,
            userName: socket.userName,
            reason: 'Repeated guideline violations'
          });

          await Store.updateRoom(normalizedRoomId, (roomDoc) => {
            if (Array.isArray(roomDoc.participants)) {
              roomDoc.participants = roomDoc.participants.filter(p => p.userId && p.userId.toString() !== socket.userId.toString());
            }
          });

          socket.leave(normalizedRoomId);
        }
      }
    });

    // Host actions
    socket.on('start-session', async ({ roomId }) => {
      if (!roomId) return;
      const normalizedRoomId = roomId.toUpperCase();
      io.to(normalizedRoomId).emit('session-started');
      await Store.updateRoom(normalizedRoomId, (roomDoc) => {
        roomDoc.status = 'active';
      });
    });

    socket.on('end-session', async ({ roomId }) => {
      if (!roomId) return;
      const normalizedRoomId = roomId.toUpperCase();
      io.to(normalizedRoomId).emit('session-ended');

      await Store.updateRoom(normalizedRoomId, (roomDoc) => {
        roomDoc.status = 'completed';
      });
    });

    // Leave room
    socket.on('leave-room', async ({ roomId }) => {
      if (!roomId || !socket.userId) return;
      const normalizedRoomId = roomId.toUpperCase();

      await Store.updateRoom(normalizedRoomId, (roomDoc) => {
        if (Array.isArray(roomDoc.participants)) {
          roomDoc.participants = roomDoc.participants.filter(p => p.userId && p.userId.toString() !== socket.userId.toString());
        }
      });

      socket.leave(normalizedRoomId);
      const updatedRoom = await Store.findRoomById(normalizedRoomId);
      if (updatedRoom) {
        io.to(normalizedRoomId).emit('room-updated', updatedRoom);
      }
      socket.to(normalizedRoomId).emit('user-left', { socketId: socket.id, userId: socket.userId, userName: socket.userName });
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      if (socket.roomId && socket.userId) {
        await Store.updateRoom(socket.roomId, (roomDoc) => {
          if (Array.isArray(roomDoc.participants)) {
            roomDoc.participants = roomDoc.participants.filter(p => p.userId && p.userId.toString() !== socket.userId.toString());
          }
        });
        const updatedRoom = await Store.findRoomById(socket.roomId);
        if (updatedRoom) {
          io.to(socket.roomId).emit('room-updated', updatedRoom);
        }
        socket.to(socket.roomId).emit('user-left', { socketId: socket.id, userId: socket.userId, userName: socket.userName });
      }
    });
  });
};
