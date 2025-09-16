import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RideService, Ride, RideRequest } from '../lib/rideService';

interface RideContextType {
  currentRide: Ride | null;
  incomingRides: RideRequest[];
  myRides: Ride[];
  rideHistory: Ride[];
  historyPagination: any;
  loading: boolean;
  error: string | null;
  
  // Actions
  getPendingRides: () => Promise<void>;
  acceptRide: (rideId: number, captainId: number) => Promise<boolean>;
  updateRideStatus: (rideId: number, status: string) => Promise<boolean>;
  getMyRides: (captain_id: number) => Promise<void>;
  getRideHistory: (page?: number, limit?: number, status?: string) => Promise<void>;

  getMyEarnings: (captain_id: number) => Promise<{ completedTrips: number; totalFare: number } | null>;
  pushLocation: (rideId: number, lat: number, lng: number, speed?: number) => Promise<void>;
  clearRide: () => void;
  setError: (error: string | null) => void;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error('useRide must be used within a RideProvider');
  }
  return context;
};

interface RideProviderProps {
  children: ReactNode;
}

export const RideProvider: React.FC<RideProviderProps> = ({ children }) => {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [incomingRides, setIncomingRides] = useState<RideRequest[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [historyPagination, setHistoryPagination] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPendingRides = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching pending rides...');
      const rides = await RideService.getPendingRides();
      console.log('Raw API response:', rides);
      console.log('Rides type:', typeof rides, 'Is array:', Array.isArray(rides));
      setIncomingRides(rides);
      console.log('Set incoming rides:', rides);
    } catch (err: any) {
      console.error('Error fetching pending rides:', err);
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to get pending rides';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const acceptRide = async (rideId: number, captainId: number): Promise<boolean> => {
    try {
      console.log('RideContext acceptRide called with rideId:', rideId, 'captainId:', captainId);
      setLoading(true);
      setError(null);
      const ride = await RideService.acceptRide(rideId, captainId);
      console.log('RideService.acceptRide returned:', ride);
      setCurrentRide(ride);
      console.log('RideContext acceptRide success, returning true');
      return true;
    } catch (err: any) {
      console.error('RideContext acceptRide error:', err);
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to accept ride';
      setError(errorMessage);
      console.log('RideContext acceptRide failed, returning false');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateRideStatus = async (rideId: number, status: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const ride = await RideService.updateRideStatus(rideId, status);
      setCurrentRide(ride);
      return true;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to update ride status';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getMyRides = async (captain_id: number): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const result = await RideService.getMyRides(captain_id);
      const ridesArray = result?.rides || [];
      setMyRides(ridesArray);
    } catch (err: any) {
      console.error('❌ RideContext: Error fetching my rides:', err);
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to get rides';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRideHistory = async (page = 1, limit = 20, status?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching ride history - page:', page, 'limit:', limit, 'status:', status);
      const result = await RideService.getRideHistory(page, limit, status);
      console.log('Ride history result:', result);
      setRideHistory(result.rides);
      setHistoryPagination(result.pagination);
    } catch (err: any) {
      console.error('❌ RideContext: Error fetching ride history:', err);
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to get ride history';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getMyEarnings = async (captain_id: number): Promise<{ completedTrips: number; totalFare: number } | null> => {
    try {
      setLoading(true);
      setError(null);
      const earnings = await RideService.getMyEarnings(captain_id);
      return earnings;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to get earnings';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pushLocation = async (rideId: number, lat: number, lng: number, speed?: number): Promise<void> => {
    try {
      await RideService.pushLocation(rideId, lat, lng, speed);
    } catch (err: any) {
      // Don't set error for location updates as they might fail frequently
      console.log('Failed to push location:', err);
    }
  };

  const clearRide = () => {
    setCurrentRide(null);
    setIncomingRides([]);
    setError(null);
  };

  const value: RideContextType = {
    currentRide,
    incomingRides,
    myRides,
    rideHistory,
    historyPagination,
    loading,
    error,
    getPendingRides,
    acceptRide,
    updateRideStatus,
    getMyRides,
    getRideHistory,
    getMyEarnings,
    pushLocation,
    clearRide,
    setError,
  };

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
};
