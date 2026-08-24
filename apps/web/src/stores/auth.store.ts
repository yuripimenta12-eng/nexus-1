import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

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
  // true depois que o estado persistido foi restaurado do localStorage;
  // guards de rota devem esperar por isso antes de redirecionar
  hasHydrated: boolean;

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
      hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          localStorage.setItem('nexus_access_token', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('nexus_refresh_token', data.refreshToken);
          }
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
          connectSocket(data.accessToken);
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (formData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', formData);
          localStorage.setItem('nexus_access_token', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('nexus_refresh_token', data.refreshToken);
          }
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
          connectSocket(data.accessToken);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          localStorage.removeItem('nexus_access_token');
          localStorage.removeItem('nexus_refresh_token');
          disconnectSocket();
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

// Marca a hidratação usando a API do persist, fora do create()
// (o callback onRehydrateStorage roda durante a criação do store e
// não pode referenciar useAuthStore — TDZ engolia o erro em silêncio)
if (typeof window !== 'undefined') {
  if (useAuthStore.persist.hasHydrated()) {
    useAuthStore.setState({ hasHydrated: true });
  } else {
    useAuthStore.persist.onFinishHydration(() => {
      useAuthStore.setState({ hasHydrated: true });
    });
  }
}
