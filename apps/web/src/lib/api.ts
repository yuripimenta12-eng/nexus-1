import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor: injecta accessToken e trata expiração ────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('nexus_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // A instância força Content-Type: application/json por padrão; em uploads
  // (FormData) isso impede o navegador de definir o boundary multipart e o
  // NestJS/multer não recebe o arquivo. Remove o header nesse caso.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;

    // Rotas de autenticação NÃO passam pelo fluxo de renovação: um 401 de
    // senha errada no /login entrava em deadlock (botão "conectando" eterno)
    const urlOriginal = String(original?.url || '');
    const rotaDeAuth = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password']
      .some((r) => urlOriginal.includes(r));

    if (error.response?.status === 401 && !original._retry && !rotaDeAuth) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Envia o refresh token via Authorization header como fallback cross-origin
        // (o cookie sameSite:none cobre o mesmo caminho; o header cobre casos em que
        //  o cookie ainda não foi propagado ou o navegador bloqueou third-party cookies)
        const storedRefresh = localStorage.getItem('nexus_refresh_token');
        const refreshConfig = storedRefresh
          ? { headers: { Authorization: `Bearer ${storedRefresh}` } }
          : {};
        const res = await api.post('/auth/refresh', undefined, refreshConfig);
        const newToken = res.data.accessToken;
        localStorage.setItem('nexus_access_token', newToken);
        if (res.data.refreshToken) {
          localStorage.setItem('nexus_refresh_token', res.data.refreshToken);
        }
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('nexus_access_token');
        localStorage.removeItem('nexus_refresh_token');
        // Limpa também o estado persistido do usuário — sem isto o app ficava
        // num "limbo": parecia logado (dados do localStorage) mas tudo dava 401
        try { localStorage.removeItem('nexus-auth'); } catch { /* ok */ }
        window.location.href = '/auth/login';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
