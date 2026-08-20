import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { useSocketStore } from '@/stores/socket.store';

export interface User {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  profile: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
    customStatus: string | null;
  } | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    displayName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          localStorage.setItem('nexus_access_token', data.accessToken);
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
          // Use socket store so DM handlers are registered immediately
          useSocketStore.getState().init(data.accessToken);
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (formData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', formData);
          localStorage.setItem('nexus_access_token', data.accessToken);
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
          // Use socket store so DM handlers are registered immediately
          useSocketStore.getState().init(data.accessToken);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          localStorage.removeItem('nexus_access_token');
          useSocketStore.getState().disconnect();
          set({ user: null, accessToken: null, isAuthenticated: false });
        }
      },

      refreshUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, accessToken: null, isAuthenticated: false });
        }
      },

      setUser: (user) => set({ user }),
      setAccessToken: (token) => {
        localStorage.setItem('nexus_access_token', token);
        set({ accessToken: token });
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
