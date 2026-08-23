import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/types';

const STORAGE_KEY = 'jobtracker.auth';

interface StoredAuth {
  token: string;
  user: User;
}

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => {
    const stored = readStoredAuth();
    setAuthToken(stored?.token ?? null);
    return stored;
  });

  const logout = useCallback(() => {
    setAuth(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Any authenticated request that comes back 401 (expired/invalid token) logs the user out.
  setUnauthorizedHandler(logout);

  const persist = useCallback((next: StoredAuth) => {
    setAuth(next);
    setAuthToken(next.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await authApi.login(payload);
      persist({ token: response.accessToken, user: response.user });
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await authApi.register(payload);
      await login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: auth !== null,
      login,
      register,
      logout,
    }),
    [auth, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
