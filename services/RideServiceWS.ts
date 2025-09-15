import { getSocket } from "../lib/socketClient";

export const RideServiceWS = {
  // Register captain with WebSocket server
  registerCaptain: (captainId: string, cb?: (ack: any) => void) => {
    const timestamp = new Date().toISOString();
    console.log(`📤 [${timestamp}] Registering captain:`, captainId);
    console.log(`📤 [${timestamp}] Captain ID type:`, typeof captainId);
    const socket = getSocket();
    console.log(`📤 [${timestamp}] Socket available:`, !!socket);
    console.log(`📤 [${timestamp}] Socket connected:`, socket?.connected);
    
    if (socket) {
      console.log(`📤 [${timestamp}] Emitting register-captain event...`);
      socket.emit("register-captain", { captainId }, (ack: any) => {
        console.log(`📥 [${timestamp}] Registration ack received:`, ack);
        if (cb) cb(ack);
      });
    } else {
      console.error(`❌ [${timestamp}] Cannot register captain - socket not available`);
    }
  },

  startRide(rideId: string, captainId: string) {
    const timestamp = new Date().toISOString();
    console.log(`📤 [${timestamp}] RideServiceWS.startRide called:`, { rideId, captainId });
    const socket = getSocket();
    console.log(`📤 [${timestamp}] Socket available:`, !!socket);
    console.log(`📤 [${timestamp}] Socket connected:`, socket?.connected);
    
    if (socket) {
      console.log(`📤 [${timestamp}] Emitting start-ride event...`);
      socket.emit("start-ride", { rideId, captainId });
      console.log(`📤 [${timestamp}] start-ride event emitted`);
    } else {
      console.error(`❌ [${timestamp}] Cannot start ride - socket not available`);
    }
  },
  
  endRide(rideId: string, captainId: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit("end-ride", { rideId, captainId });
    }
  },  

  // Accept a ride request
  acceptRide: (rideId: string, captainId: string, completeRideData?: any, cb?: (ack: any) => void) => {
    const timestamp = new Date().toISOString();
    console.log(`📤 [${timestamp}] Accepting ride:`, { rideId, captainId });
    console.log(`📤 [${timestamp}] Complete ride data:`, completeRideData);
    
    const socket = getSocket();
    if (socket) {
      // Send complete ride data including captain details
      const acceptData = {
        rideId,
        captainId,
        completeRideData: completeRideData || null
      };
      
      console.log(`📤 [${timestamp}] Emitting accept-ride with complete data:`, acceptData);
      socket.emit("accept-ride", acceptData, cb);
    }
  },

  // Send location update during ride
  sendLocationUpdate: (rideId: string, riderId: string, lat: number, lng: number, cb?: (ack: any) => void) => {
    console.log("📤 Sending location update:", { rideId, riderId, lat, lng });
    const socket = getSocket();
    if (socket) {
      socket.emit("location-update", { rideId, riderId, lat, lng }, cb);
    }
  },

  // Update ride status
  updateRideStatus: (rideId: string, status: string, cb?: (ack: any) => void) => {
    console.log("📤 Updating ride status:", { rideId, status });
    const socket = getSocket();
    if (socket) {
      socket.emit("ride-status", { rideId, status }, cb);
    }
  },

  // Update captain status
  updateCaptainStatus: (captainId: string, status: string, cb?: (ack: any) => void) => {
    console.log("📤 Updating captain status:", { captainId, status });
    const socket = getSocket();
    if (socket) {
      socket.emit("captain-status", { captainId, status }, cb);
    }
  },

  // Event listeners
  onNewRide: (handler: (ride: any) => void) => {
    const timestamp = new Date().toISOString();
    console.log(`🔧 [${timestamp}] RideServiceWS.onNewRide: Setting up listener`);
    const socket = getSocket();
    console.log(`🔧 [${timestamp}] RideServiceWS.onNewRide: Socket available:`, !!socket);
    console.log(`🔧 [${timestamp}] RideServiceWS.onNewRide: Socket connected:`, socket?.connected);
    if (socket) {
      // Remove any existing listeners first to prevent duplicates
      socket.off("new-ride");
      console.log(`🔧 [${timestamp}] RideServiceWS.onNewRide: Removed existing listeners, adding new 'new-ride' listener`);
      socket.on("new-ride", (ride: any) => {
        const eventTimestamp = new Date().toISOString();
        console.log(`🔧 [${eventTimestamp}] ===== RIDESERVICEWS NEW-RIDE EVENT =====`);
        console.log(`🔧 [${eventTimestamp}] RideServiceWS.onNewRide: Event received, calling handler`);
        console.log(`🔧 [${eventTimestamp}] Raw ride data:`, JSON.stringify(ride, null, 2));
        console.log(`🔧 [${eventTimestamp}] Ride type:`, typeof ride);
        console.log(`🔧 [${eventTimestamp}] Is array:`, Array.isArray(ride));
        console.log(`🔧 [${eventTimestamp}] About to call handler...`);
        handler(ride);
        console.log(`🔧 [${eventTimestamp}] Handler called successfully`);
        console.log(`🔧 [${eventTimestamp}] ===== END RIDESERVICEWS NEW-RIDE EVENT =====`);
      });
    } else {
      console.error(`❌ [${timestamp}] RideServiceWS.onNewRide: Cannot set up listener - socket not available`);
    }
  },

  onRideAssigned: (handler: (ride: any) => void) => {
    const socket = getSocket();
    console.log("🔧 RideServiceWS.onRideAssigned: Setting up listener");
    if (socket) {
      socket.on("ride-assigned", handler);
    }
  },

  onRideStarted: (handler: (ride: any) => void) => {
    const timestamp = new Date().toISOString();
    console.log(`🔧 [${timestamp}] RideServiceWS.onRideStarted: Setting up listener`);
    const socket = getSocket();
    console.log(`🔧 [${timestamp}] Socket available:`, !!socket);
    console.log(`🔧 [${timestamp}] Socket connected:`, socket?.connected);
    
    if (socket) {
      console.log(`🔧 [${timestamp}] Adding ride-started event listener`);
      socket.on("ride-started", (ride: any) => {
        const eventTimestamp = new Date().toISOString();
        console.log(`🔧 [${eventTimestamp}] RideServiceWS.onRideStarted: Event received, calling handler`);
        handler(ride);
      });
    } else {
      console.error(`❌ [${timestamp}] RideServiceWS.onRideStarted: Cannot set up listener - socket not available`);
    }
  },

  onRideCompleted: (handler: (ride: any) => void) => {
    const socket = getSocket();
    console.log("🔧 RideServiceWS.onRideCompleted: Setting up listener");
    if (socket) {
      socket.on("ride-completed", handler);
    }
  },

  onRideCancelled: (handler: (ride: any) => void) => {
    const socket = getSocket();
    console.log("🔧 RideServiceWS.onRideCancelled: Setting up listener");
    if (socket) {
      socket.on("ride-cancelled", handler);
    }
  },

  onRideStatus: (handler: (data: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.on("ride-status-updated", handler);
    }
  },
  

  onError: (handler: (error: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.on("error", handler);
    }
  },

  // Remove event listeners
  off: (event: string) => {
    const socket = getSocket();
    if (socket) {
      socket.off(event);
    }
  },

  // Connection status
  isConnected: () => {
    const socket = getSocket();
    return socket ? socket.connected : false;
  },
  
  // Connect/disconnect
  connect: () => {
    const socket = getSocket();
    if (socket) {
      return socket.connect();
    }
  },
  disconnect: () => {
    const socket = getSocket();
    if (socket) {
      return socket.disconnect();
    }
  },
};