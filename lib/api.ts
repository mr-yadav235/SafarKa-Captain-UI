import axios from 'axios';
import Constants from 'expo-constants';

const baseURL = (Constants?.expoConfig?.extra as any)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.54:3000';

console.log('🌐 API Base URL:', baseURL);

export const api = axios.create({
  baseURL,
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  console.log('➡️ API Request:', config.method?.toUpperCase(), config.url);
  if (config.params) console.log('   Params:', config.params);
  if (config.data) console.log('   Data:', config.data);
  if (config.headers) console.log('   Headers:', config.headers);
  return config;
});

// Log all responses
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    console.log('   Data:', response.data);
    console.log('   Headers:', response.headers);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.config?.url, error.response?.status);
    console.error('   Data:', error.response?.data);
    console.error('   Message:', error.message);
    console.error('   Full error:', error);
    return Promise.reject(error);
  }
);

export function setAuthToken(token?: string) {
  console.log('🔑 Setting auth token:', token ? `${token.substring(0, 20)}...` : 'null');
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    console.log('✅ Auth token set in headers');
  } else {
    delete api.defaults.headers.common.Authorization;
    console.log('❌ Auth token removed from headers');
  }
  console.log('📋 Current headers:', api.defaults.headers.common);
}

// Captain API endpoints
export const CaptainApi = {
  goOnlineMe: () => api.post('/captains/me/online'),
  goOfflineMe: () => api.post('/captains/me/offline'),
  updateStatus: (id: string, payload: { current_status: string }) => api.patch(`/captains/${id}/status`, payload),
  heartbeat: (id: string, payload: { lat: number; lng: number }) => api.post(`/captains/${id}/heartbeat`, payload),
  nearby: (params: { lat: number; lng: number; radius?: number; count?: number }) =>
    api.get('/captains/nearby', { params }),
  myTrips: (params?: { page?: number; pageSize?: number }) =>
    api.get('/captains/me/trips', { params }).then(res => res.data),
  myEarnings: (params?: { from?: string; to?: string }) => api.get('/captains/me/earnings', { params }),
  
  // Ride management
  getPendingRides: () => api.get('/rides/pending'),
  getRideHistory: (page = 1, limit = 20, status?: string) => 
    api.get('/rides/history', { params: { page, limit, status } }),
  acceptRide: (rideId: number) => api.post(`/rides/${rideId}/accept`),
  updateRideStatus: (rideId: number, status: string) => api.patch(`/rides/${rideId}/status`, { status }),
  getRide: (rideId: number) => api.get(`/rides/${rideId}`),
  pushLocation: (rideId: number, lat: number, lng: number, speed?: number) => 
    api.post(`/rides/${rideId}/location`, { latitude: lat, longitude: lng, speed }),
};

export const AuthApi = {
  login: (payload: { phone_number: string; password: string }) => api.post('/captains/login',  payload),
  register: (payload: { name: string; phone_number: string; password: string; vehicleNumber?: string }) =>
    api.post('/captains/register', payload),
};



