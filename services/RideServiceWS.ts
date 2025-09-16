import { getSocket } from "../lib/socketClient";

export const RideServiceWS = {
  // Register captain with WebSocket server
  registerCaptain: (captainId: string, cb?: (ack: any) => void) => {
    const socket = getSocket();
    
    if (socket) {
      socket.emit("register-captain", { captainId }, (ack: any) => {
        if (cb) cb(ack);
      });
    }
  },

  startRide(rideId: string, captainId: string) {
    const socket = getSocket();
    
    if (socket) {
      socket.emit("start-ride", { rideId, captainId });
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
    const socket = getSocket();
    if (socket) {
      // Send complete ride data including captain details
      const acceptData = {
        rideId,
        captainId,
        completeRideData: completeRideData || null
      };
      
      socket.emit("accept-ride", acceptData, cb);
    }
  },

  // Send location update during ride
  sendLocationUpdate: (rideId: string, riderId: string, captainId: string, lat: number, lng: number, cb?: (ack: any) => void) => {
    const socket = getSocket();
    if (socket) {
      const timestamp = new Date().toISOString();
      console.log(`📍 [${timestamp}] Sending location-update via WebSocket:`, {
        rideId,
        riderId,
        captainId,
        lat,
        lng,
        socketConnected: socket.connected
      });
      
      socket.emit("location-update", { rideId, riderId, captainId, lat, lng }, (ack: any) => {
        if (ack) {
          console.log(`📍 [${timestamp}] Location update acknowledged:`, ack);
        }
        if (cb) cb(ack);
      });
    } else {
      console.error("❌ Cannot send location update - socket not available");
    }
  },

  // Update ride status
  updateRideStatus: (rideId: string, status: string, cb?: (ack: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("ride-status", { rideId, status }, cb);
    }
  },

  // Update captain status
  updateCaptainStatus: (captainId: string, status: string, cb?: (ack: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("captain-status", { captainId, status }, cb);
    }
  },

  // Event listeners
  onNewRide: (handler: (ride: any) => void) => {
    const socket = getSocket();
    console.log(`🔧 RideServiceWS.onNewRide: Setting up listener`);
    console.log(`🔧 RideServiceWS.onNewRide: Socket available:`, !!socket);
    console.log(`🔧 RideServiceWS.onNewRide: Socket connected:`, socket?.connected);
    
    if (socket) {
      // Remove any existing listeners first to prevent duplicates
      socket.off("new-ride");
      console.log(`🔧 RideServiceWS.onNewRide: Removed existing listeners, adding new 'new-ride' listener`);
      
      const newRideHandler = (ride: any) => {
        const eventTimestamp = new Date().toISOString();
        console.log(`🚖 [${eventTimestamp}] NEW Ride event detected`, JSON.stringify(ride, null, 2));
        console.log(`🔧 RideServiceWS.onNewRide: Calling handler...`);
        handler(ride);
        console.log(`🔧 RideServiceWS.onNewRide: Handler called successfully`);
      };
      
      socket.on("new-ride", newRideHandler);
      console.log(`🔧 RideServiceWS.onNewRide: Listener added successfully`);
      
      // Test if the listener was actually added
      const listeners = socket.listeners("new-ride");
      console.log(`🔧 RideServiceWS.onNewRide: Current listeners count:`, listeners.length);
    } else {
      console.error(`❌ RideServiceWS.onNewRide: Cannot set up listener - socket not available`);
    }
  },

  onRideAssigned: (handler: (ride: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.on("ride-assigned", handler);
    }
  },

  onRideStarted: (handler: (ride: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.on("ride-started", (ride: any) => {
        handler(ride);
      });
    }
  },

  onRideCompleted: (handler: (ride: any) => void) => {
    const socket = getSocket();
    if (socket) {
      socket.on("ride-completed", handler);
    }
  },

  onRideCancelled: (handler: (ride: any) => void) => {
    const socket = getSocket();
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