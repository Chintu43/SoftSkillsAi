import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      transports: ['websocket', 'polling']
    });
  }

  return socket;
};