import { io, Socket } from "socket.io-client";
import { getToken } from "../store/authStore";

let socket: Socket | null = null;

// Initialize socket with current token
const initializeSocket = () => {
  const token = getToken();
  console.log("🔗 Captain initializing WS with token:", token ? `${token.substring(0, 20)}...` : 'null');
  console.log("🔗 Full token:", token);
  console.log("🔗 Token type:", typeof token);
  console.log("🔗 Token length:", token ? token.length : 0);
  
  // Validate JWT format
  if (token) {
    const parts = token.split('.');
    console.log("🔗 JWT parts count:", parts.length);
    console.log("🔗 JWT header:", parts[0] ? parts[0].substring(0, 20) + '...' : 'missing');
    console.log("🔗 JWT payload:", parts[1] ? parts[1].substring(0, 20) + '...' : 'missing');
    console.log("🔗 JWT signature:", parts[2] ? parts[2].substring(0, 20) + '...' : 'missing');
    
    if (parts.length !== 3) {
      console.error("❌ Invalid JWT format - should have 3 parts separated by dots");
    }
    
    if (!token.startsWith('eyJ')) {
      console.error("❌ Invalid JWT format - should start with 'eyJ'");
    }
  } else {
    console.error("❌ No token available");
  }
  
  socket = io("http://192.168.1.54:5000", {
    auth: { token },
    transports: ["websocket"],   // 👈 force websocket only
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  console.log("🔗 Captain connecting to WS with auth:", socket.auth);
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
    console.log("✅ Captain connected to WS:", socketInstance.id);
  });

  socketInstance.on("disconnect", (reason) => {
    console.warn("⚠️ Captain disconnected:", reason);
  });

  socketInstance.on("connect_error", (err) => {
    console.error("❌ Captain WS connect error:", err.message);
  });

  // 🔹 Log all incoming events with enhanced visibility
  socketInstance.onAny((event, ...args) => {
    const timestamp = new Date().toISOString();
    console.log(`⬅️ [${timestamp}] Captain incoming event: ${event}`, args);
    
    // Special handling for new-ride events to make them more visible
    if (event === 'new-ride') {
      console.log(`🚖 [${timestamp}] ===== NEW RIDE EVENT DETECTED =====`);
      console.log(`🚖 [${timestamp}] Event: ${event}`);
      console.log(`🚖 [${timestamp}] Args count: ${args.length}`);
      console.log(`🚖 [${timestamp}] Args:`, JSON.stringify(args, null, 2));
      console.log(`🚖 [${timestamp}] ===== END NEW RIDE EVENT =====`);
    }
  });

  // 🔹 Wrap emit to log outgoing events
  const originalEmit = socketInstance.emit;

  socketInstance.emit = (event, ...args) => {
    console.log(`➡️ Captain outgoing event: ${event}`, args);
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
