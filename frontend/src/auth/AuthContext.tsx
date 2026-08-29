import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/types';

const STORAGE_KEY = 'jobtracker.auth';

interface StoredAuth {
  token: string;
  user: User;
}

// "Remember me" decides which of these a session is written to — checked
// persists across browser restarts (localStorage), unchecked clears itself
// once the tab/browser closes (sessionStorage). Reading checks both so a
// session started either way is picked up the same on reload.
function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
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
  login: (payload: LoginPayload, remember?: boolean) => Promise<void>;
  loginWithGoogle: (accessToken: string, remember?: boolean) => Promise<void>;
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
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Any authenticated request that comes back 401 (expired/invalid token) logs the user out.
  setUnauthorizedHandler(logout);

  const persist = useCallback((next: StoredAuth, remember: boolean) => {
    setAuth(next);
    setAuthToken(next.token);
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(STORAGE_KEY, JSON.stringify(next));
    other.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload, remember = true) => {
      const response = await authApi.login(payload);
      persist({ token: response.accessToken, user: response.user }, remember);
    },
    [persist],
  );

  const loginWithGoogle = useCallback(
    async (accessToken: string, remember = true) => {
      const response = await authApi.googleLogin(accessToken);
      persist({ token: response.accessToken, user: response.user }, remember);
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
      loginWithGoogle,
      register,
      logout,
    }),
    [auth, login, loginWithGoogle, register, logout],
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
