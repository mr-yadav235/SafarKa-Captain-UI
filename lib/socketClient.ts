import { io, Socket } from "socket.io-client";
import { getToken } from "../store/authStore";

let socket: Socket | null = null;

// Initialize socket with current token
const initializeSocket = () => {
  const token = getToken();
  
  socket = io("http://192.168.1.54:5000", {
    auth: { token },
    transports: ["websocket"],   // 👈 force websocket only
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socket;
};

// Get existing socket (don't auto-create)
const getSocket = () => {
  return socket;
};

// Create socket explicitly
export const createSocket = () => {
  if (!socket) {
    socket = initializeSocket();
    setupEventListeners(socket);
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log("🔌 Force disconnecting socket...");
    socket.disconnect();
    socket = null;
    console.log("✅ Socket disconnected and cleared");
  }
};

export const isSocketConnected = () => {
  return socket ? socket.connected : false;
};

// Don't auto-connect - only connect when captain goes online
// if (getToken()) {
//   socket = initializeSocket();
// }

// Export socket and getSocket
export { socket, getSocket };

// Setup event listeners when socket is available
const setupEventListeners = (socketInstance: Socket) => {
  socketInstance.on("connect", () => {
    // Connected
  });

  socketInstance.on("disconnect", (reason) => {
    // Disconnected
  });

  socketInstance.on("connect_error", (err) => {
    console.error("❌ Captain WS connect error:", err.message);
  });

  // 🔹 Log all incoming events with enhanced visibility
  socketInstance.onAny((event, ...args) => {
    const timestamp = new Date().toISOString();
    
    // Special handling for new-ride events to make them more visible
    if (event === 'new-ride') {
      console.log(`🚖 [${timestamp}] Captain incoming event: new-ride`, JSON.stringify(args, null, 2));
    }
  });

  // 🔹 Wrap emit to log outgoing events
  const originalEmit = socketInstance.emit;

  socketInstance.emit = (event, ...args) => {
    return originalEmit.call(socketInstance, event, ...args);
  };
};

// Setup event listeners if socket exists
if (socket) {
  setupEventListeners(socket);
}

// Function to reconnect with new token
export const reconnectWithToken = () => {
  console.log("🔄 Captain reconnecting WebSocket with new token...");
  if (socket) {
    socket.disconnect();
  }
  socket = initializeSocket();
  setupEventListeners(socket);
  return socket;
};
