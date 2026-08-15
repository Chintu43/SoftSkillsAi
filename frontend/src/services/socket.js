import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('/', {
      autoConnect: true,
      reconnection: true
    });
  }
  return socket;
};
