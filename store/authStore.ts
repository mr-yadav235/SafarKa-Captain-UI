import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthApi, setAuthToken } from '@/lib/api';

type User = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  license_number?: string;
  current_vehicle?: {
    id: number;
    vehicle_type: string;
    make: string;
    model: string;
    year?: number;
    color: string;
    plate_number: string;
    capacity: number;
  };
};

type AuthState = {
  user?: User;
  token?: string;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (phone_number: string, password: string) => Promise<void>;
  register: (payload: { name: string; phone_number: string; password: string; vehicleNumber?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentVehicle: (vehicle: User['current_vehicle']) => Promise<void>;
};

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: undefined,
  token: undefined,
  loading: false,
  hydrate: async () => {
    set({ loading: true });
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      
      if (!token || !userJson) {
        set({ loading: false });
        return;
      }
      
      setAuthToken(token);
      const user = JSON.parse(userJson) as User;
      set({ user, token, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  login: async (phone_number, password) => {
    set({ loading: true });
    try {
      const res = await AuthApi.login({ phone_number, password });
      const { token, captain } = res.data.data;

      // map captain -> User with complete profile
      const user: User = {
        id: captain.id,
        name: captain.name,
        phone: captain.phone_number,
        email: captain.email,
        license_number: captain.license_number,
        current_vehicle: captain.current_vehicle
      };
      
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      
      setAuthToken(token);
      set({ token, user });
    } catch (error) {
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  register: async (payload) => {
    set({ loading: true });
    try {
      const res = await AuthApi.register(payload);
      return res.data; // just return the response
    } catch (error) {
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      setAuthToken(undefined);
      set({ user: undefined, token: undefined });
    } catch (error) {
      // Even if there's an error, clear the state
      set({ user: undefined, token: undefined });
    }
  },
  updateCurrentVehicle: async (vehicle) => {
    try {
      const { user } = get();
      if (!user) {
        console.log("❌ updateCurrentVehicle: No user in auth store");
        return;
      }
      
      console.log("🔄 updateCurrentVehicle: Updating with vehicle:", vehicle);
      console.log("🔄 updateCurrentVehicle: Current user before update:", user);
      
      // Update user object with new current vehicle
      const updatedUser = { ...user, current_vehicle: vehicle };
      
      console.log("🔄 updateCurrentVehicle: Updated user:", updatedUser);
      
      // Save to SecureStore
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      
      // Update state
      set({ user: updatedUser });
      
      console.log("✅ updateCurrentVehicle: Auth store updated successfully");
    } catch (error) {
      console.error("❌ updateCurrentVehicle: Failed to update:", error);
    }
  },
}));

// Export getToken function for WebSocket client
export const getToken = () => {
  const state = useAuthStore.getState();
  return state.token;
};

// Export getCaptainProfile function for location updates
export const getCaptainProfile = () => {
  const state = useAuthStore.getState();
  const user = state.user;
  if (!user) {
    console.log("❌ getCaptainProfile: No user in auth store");
    return null;
  }
  
  const profile = {
    name: user.name,
    phone_number: user.phone,
    email: user.email || '',
    license_number: user.license_number || '',
    current_vehicle: user.current_vehicle
  };
  
  console.log("👤 getCaptainProfile: Returning profile:", profile);
  console.log("👤 getCaptainProfile: Current vehicle details:", user.current_vehicle);
  
  return profile;
};
