import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthApi, setAuthToken } from '@/lib/api';

type User = {
  id: string;
  name: string;
  phone: string;
};

type AuthState = {
  user?: User;
  token?: string;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (phone_number: string, password: string) => Promise<void>;
  register: (payload: { name: string; phone_number: string; password: string; vehicleNumber?: string }) => Promise<void>;
  logout: () => Promise<void>;
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
      console.log('🔄 Hydrating auth state...');
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      console.log('🔍 Retrieved token:', token ? `${token.substring(0, 20)}...` : 'null');
      console.log('🔍 Retrieved user:', userJson ? 'exists' : 'null');
      
      if (!token || !userJson) {
        console.log('❌ No token or user found, skipping hydration');
        set({ loading: false });
        return;
      }
      
      console.log('✅ Setting auth token from hydration');
      setAuthToken(token);
      const user = JSON.parse(userJson) as User;
      set({ user, token, loading: false });
      console.log('✅ Auth state hydrated successfully');
    } catch (error) {
      console.error('❌ Hydrate error:', error);
      set({ loading: false });
    }
  },
  login: async (phone_number, password) => {
    set({ loading: true });
    try {
      console.log('🔐 Attempting login...');
      const res = await AuthApi.login({ phone_number, password });
      console.log('✅ Login response:', res.data);
      const { token, captain } = res.data.data;

      // map captain -> User
      const user: User = {
        id: captain.captain_id,
        name: captain.name,
        phone: captain.phone_number
      };
      console.log('👤 Mapped user:', user);
      console.log('🔑 Received token:', token ? `${token.substring(0, 20)}...` : 'null');
      
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      console.log('💾 Token and user saved to SecureStore');
      
      setAuthToken(token);
      set({ token, user });
      console.log('✅ Auth state set with user:', user);
    } catch (error) {
      console.error('❌ Auth store login error:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  register: async (payload) => {
    set({ loading: true });
    try {
      const res = await AuthApi.register(payload);
      console.log('Register response:', res.data);
      return res.data; // just return the response
    } catch (error) {
      console.error('Auth store register error:', error);
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
      console.error('Logout error:', error);
      // Even if there's an error, clear the state
      set({ user: undefined, token: undefined });
    }
  },
}));


