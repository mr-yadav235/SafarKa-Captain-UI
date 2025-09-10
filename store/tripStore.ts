import { create } from 'zustand';

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
  setOnline: (online) => set({ online }),
  receiveRide: (ride) => set({ currentRide: ride, phase: 'incoming' }),
  acceptRide: () => {
    const currentState = get();
    console.log("TripStore acceptRide called - current ride:", currentState.currentRide);
    console.log("TripStore acceptRide called - current phase:", currentState.phase);
    if (!currentState.currentRide) {
      console.log("No current ride, returning early");
      return;
    }
    console.log("Setting phase to 'accepted'");
    set({ phase: 'accepted' });
    console.log("Phase set to 'accepted'");
  },
  declineRide: () => set({ currentRide: undefined, phase: 'idle' }),
  startRide: () => {
    if (!get().currentRide) return;
    set({ phase: 'in_progress' });
  },
  endRide: () => set({ phase: 'completed' }),
  clear: () => set({ currentRide: undefined, phase: 'idle' }),
}));


