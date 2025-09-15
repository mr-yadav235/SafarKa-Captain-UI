import { create } from 'zustand';
import { RideServiceWS } from '../services/RideServiceWS';

export type RideRequest = {
  id: string;
  pickup: string;
  dropoff: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  etaMinutes?: number;
};

type TripState = {
  online: boolean;
  currentRide?: RideRequest;
  phase: 'idle' | 'incoming' | 'accepted' | 'in_progress' | 'completed';
  rideOfferCountdown: number;
  setOnline: (online: boolean) => void;
  receiveRide: (ride: RideRequest) => void;
  acceptRide: () => void;
  declineRide: () => void;
  startRide: () => void;
  endRide: () => void;
  clear: () => void;
};

export const useTripStore = create<TripState>((set, get) => ({
  online: false,
  currentRide: undefined,
  phase: 'idle',
  rideOfferCountdown: 0,
  setOnline: (online) => {
    set({ online });
    // Note: Captain registration will be handled in the UI component
    // to avoid circular dependencies
  },
  receiveRide: (ride) => {
    const timestamp = new Date().toISOString();
    console.log(`🏪 [${timestamp}] ===== TRIP STORE RECEIVE RIDE =====`);
    console.log(`🏪 [${timestamp}] TripStore receiveRide called with:`, JSON.stringify(ride, null, 2));
    console.log(`🏪 [${timestamp}] TripStore current state before update:`, get());
    
    set({ currentRide: ride, phase: 'incoming', rideOfferCountdown: 10 });
    
    console.log(`🏪 [${timestamp}] ===== TRIP STORE STATE UPDATED =====`);
    console.log(`🏪 [${timestamp}] Phase set to: 'incoming'`);
    console.log(`🏪 [${timestamp}] Current ride set to:`, ride.id);
    console.log(`🏪 [${timestamp}] Countdown set to: 10 seconds`);
    console.log(`🏪 [${timestamp}] TripStore current state after update:`, get());
    console.log(`🏪 [${timestamp}] Modal should now be visible in UI`);
    
    // Start countdown timer
    console.log(`⏰ [${timestamp}] Starting 10-second countdown timer for ride offer`);
    const countdownInterval = setInterval(() => {
      const currentState = get();
      if (currentState.rideOfferCountdown > 0) {
        set({ rideOfferCountdown: currentState.rideOfferCountdown - 1 });
        if (currentState.rideOfferCountdown <= 3) {
          console.log(`⏰ Countdown warning: ${currentState.rideOfferCountdown} seconds remaining`);
        }
      } else {
        clearInterval(countdownInterval);
        // Auto-decline if countdown reaches 0
        if (currentState.phase === 'incoming') {
          console.log(`⏰ [${new Date().toISOString()}] Ride offer countdown expired, auto-declining ride ${currentState.currentRide?.id}`);
          set({ phase: 'idle', currentRide: undefined, rideOfferCountdown: 0 });
        }
      }
    }, 1000);
  },
  acceptRide: () => {
    const currentState = get();
    console.log("TripStore acceptRide called - current ride:", currentState.currentRide);
    console.log("TripStore acceptRide called - current phase:", currentState.phase);
    if (!currentState.currentRide) {
      console.log("No current ride, returning early");
      return;
    }
    console.log("Setting phase to 'accepted'");
    set({ phase: 'accepted', rideOfferCountdown: 0 });
    console.log("Phase set to 'accepted'");
  },
  declineRide: () => set({ currentRide: undefined, phase: 'idle', rideOfferCountdown: 0 }),
  startRide: () => {
    const { currentRide } = get();
    if (!currentRide) return;
  
    // Update local state only - WebSocket call handled in component
    set({ phase: 'in_progress' });
  },
  
  endRide: () => {
    const { currentRide } = get();
    if (!currentRide) return;
  
    // Update local state only - WebSocket call handled in component
    set({ phase: 'completed' });
  },
  
  clear: () => set({ currentRide: undefined, phase: 'idle', rideOfferCountdown: 0 }),
}));