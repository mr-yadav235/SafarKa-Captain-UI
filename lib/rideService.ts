import { api } from './api';
import axios from 'axios';

const REDIS_API_BASE = "http://192.168.1.54:5002"; // Redis microservice

export interface RideRequest {
  id: number;
  pickup: string;
  dropoff: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  customerId: number;
  customer?: {
    id: number;
    name: string;
    phone_number: string;
  };
  created_at: string;
}

export interface Ride {
  id: number;
  pickup: string;
  dropoff: string;
  status: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  fare: number;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number;
  drop_lng: number;
  customer_id: number;
  captain_id?: number;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  customer?: {
    id: number;
    name: string;
    phone_number: string;
  };
  captain?: {
    id: number;
    name: string;
    phone_number: string;
    vehicle_type: string;
    vehicle_number: string;
  };
}
export const RideService = {
  getPendingRides: async (): Promise<RideRequest[]> => {
    console.log('Making API call to /rides/pending');
    const response = await api.get('/rides/pending');
    console.log('API response:', response.data);

    // Correctly extract rides array
    const ridesArray = response.data?.rides || response.data?.data?.rides || [];
    console.log('Extracted rides array:', ridesArray);

    // Map to RideRequest interface
    return ridesArray.map((ride: any) => ({
      id: ride.id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      pickupLat: ride.pickup_lat,
      pickupLng: ride.pickup_lng,
      dropLat: ride.drop_lat,
      dropLng: ride.drop_lng,
      fare: ride.fare,
      customerId: ride.customer_id,
      customer: ride.customer,
      created_at: ride.created_at,
    }));
  },

  getRideHistory: async (page = 1, limit = 20, status?: string): Promise<{ rides: Ride[]; pagination: any }> => {
    console.log('Getting ride history - page:', page, 'limit:', limit, 'status:', status);
    const response = await api.get('/captains/me/trips', { params: { page, pageSize: limit, status } });
    console.log('Ride history response:', response.data);
    
    const result = response.data?.data || response.data;
    const rides = result?.items || result?.rides || [];
    const pagination = result?.pagination || {
      page: result?.page || page,
      pages: result?.pages || Math.ceil((result?.total || 0) / limit),
      total: result?.total || 0,
      limit: limit
    };
    
    return {
      rides: rides.map((ride: any) => ({
        id: ride.id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        status: ride.status,
        fare: ride.fare,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        drop_lat: ride.drop_lat,
        drop_lng: ride.drop_lng,
        customer_id: ride.customer_id,
        captain_id: ride.captain_id,
        created_at: ride.created_at,
        started_at: ride.started_at,
        ended_at: ride.ended_at,
        customer: ride.customer,
      })),
      pagination
    };
  },
/*
export const RideService = {
  // Get pending ride requests
  getPendingRides: async (): Promise<RideRequest[]> => {
    console.log('Making API call to /rides/pending');
    const response = await api.get('/rides/pending');
    console.log('API response status:', response.status);
    console.log('API response data:', response.data);
    console.log('API response data type:', typeof response.data);
    console.log('API response data keys:', Object.keys(response.data || {}));
    
    // Handle different response structures
    let rides = [];
    if (response.data?.rides) {
      rides = response.data.rides;
      console.log('Found rides in response.data.rides');
    } else if (response.data?.data) {
      rides = response.data.data;
      console.log('Found rides in response.data.data');
    } else if (Array.isArray(response.data)) {
      rides = response.data;
      console.log('Found rides as direct array in response.data');
    } else {
      console.log('No rides found in expected locations');
      console.log('Full response structure:', JSON.stringify(response.data, null, 2));
    }
    
    console.log('Raw rides from API:', rides);
    console.log('Rides type:', typeof rides);
    console.log('Is rides array:', Array.isArray(rides));
    
    // Ensure rides is an array before mapping
    if (!Array.isArray(rides)) {
      console.log('Rides is not an array, returning empty array');
      return [];
    }
    
    // Map API response to RideRequest interface
    const mappedRides = rides.map((ride: any) => ({
      id: ride.id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      pickupLat: ride.pickup_lat,
      pickupLng: ride.pickup_lng,
      dropLat: ride.drop_lat,
      dropLng: ride.drop_lng,
      fare: ride.fare,
      customerId: ride.customer_id,
      customer: ride.customer,
      created_at: ride.created_at,
    }));
    
    console.log('Mapped rides:', mappedRides);
    console.log('Mapped rides length:', mappedRides.length);
    return mappedRides;
  },

  */

  // Accept a ride request via Redis service
  acceptRide: async (rideId: number, captainId: number): Promise<any> => {
    console.log('RideService acceptRide called with rideId:', rideId, 'captainId:', captainId);
    console.log('Making Redis API call to:', `${REDIS_API_BASE}/rides/${rideId}/accept`);
    
    try {
      const response = await axios.post(`${REDIS_API_BASE}/rides/${rideId}/accept`, {
        captainId: captainId
      });
      console.log('Accept ride Redis API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Accept ride Redis API error:', error);
      throw error;
    }
  },

  // Update ride status
  updateRideStatus: async (rideId: number, status: string): Promise<Ride> => {
    const response = await api.patch(`/rides/${rideId}/status`, { status });
    return response.data?.data || response.data;
  },

  // Get ride details via Redis service
  getRide: async (rideId: number): Promise<any> => {
    console.log('RideService getRide called with rideId:', rideId);
    console.log('Making Redis API call to:', `${REDIS_API_BASE}/rides/${rideId}`);
    
    try {
      const response = await axios.get(`${REDIS_API_BASE}/rides/${rideId}`);
      console.log('Get ride Redis API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Get ride Redis API error:', error);
      throw error;
    }
  },

  // Start a ride via Redis service
  startRide: async (rideId: number, captainId: number): Promise<any> => {
    console.log('RideService startRide called with rideId:', rideId, 'captainId:', captainId);
    console.log('Making Redis API call to:', `${REDIS_API_BASE}/rides/${rideId}/start`);
    
    try {
      const response = await axios.post(`${REDIS_API_BASE}/rides/${rideId}/start`, {
        captainId: captainId
      });
      console.log('Start ride Redis API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Start ride Redis API error:', error);
      throw error;
    }
  },

  // End a ride via Redis service
  endRide: async (rideId: number, captainId: number): Promise<any> => {
    console.log('RideService endRide called with rideId:', rideId, 'captainId:', captainId);
    console.log('Making Redis API call to:', `${REDIS_API_BASE}/rides/${rideId}/end`);
    
    try {
      const response = await axios.post(`${REDIS_API_BASE}/rides/${rideId}/end`, {
        captainId: captainId
      });
      console.log('End ride Redis API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('End ride Redis API error:', error);
      throw error;
    }
  },

  // Get captain's assigned rides (same as getRideHistory but with different return structure)
  getMyRides: async (captain_id: number, page = 1, pageSize = 20): Promise<{ rides: Ride[]; total: number; page: number; pageSize: number }> => {
    const response = await api.get('/captains/me/trips', {
      params: { page, pageSize }
    });
    
    const result = response.data?.data || response.data;
    
    // API returns 'items' but we need to return 'rides' for consistency
    return {
      rides: result?.items || [],
      total: result?.total || 0,
      page: result?.page || page,
      pageSize: result?.pageSize || pageSize
    };
  },

  // Get captain's earnings
  getMyEarnings: async (captain_id: number, from?: string, to?: string): Promise<{ completedTrips: number; totalFare: number }> => {
    const response = await api.get('/captains/me/earnings', {
      params: { from, to }
    });
    return response.data?.data || response.data;
  },

  // Push location update
  pushLocation: async (rideId: number, latitude: number, longitude: number, speed?: number): Promise<any> => {
    const response = await api.post(`/rides/${rideId}/location`, {
      latitude,
      longitude,
      speed
    });
    return response.data?.data || response.data;
  }
};
