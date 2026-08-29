import { api } from './client';
import type { AuthResponse, User } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) => api.post<User>('/auth/register', payload),
  login: (payload: LoginPayload) => api.post<AuthResponse>('/auth/login', payload),
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),
  googleLogin: (accessToken: string) => api.post<AuthResponse>('/auth/google', { accessToken }),
};
