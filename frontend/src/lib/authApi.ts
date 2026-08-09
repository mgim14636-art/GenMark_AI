export type AuthProviderName = 'kakao' | 'google' | 'fake'

export interface UserSummary {
  id: string
  email: string
  name: string
  provider: AuthProviderName
  isFirstLogin: boolean
  onboardingCompleted: boolean
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserSummary
  resumeProjectId: string | null
}

export interface RefreshResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface MeResult {
  user: UserSummary
  resumeProjectId: string | null
}

export class ApiError extends Error {
  code: string
  requestId?: string
  details?: unknown[]

  constructor(message: string, code: string, requestId?: string, details?: unknown[]) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

export const authApi = {
  login: (provider: AuthProviderName, idToken: string, redirectUri?: string) =>
    apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ provider, idToken, redirectUri }),
    }),

  refresh: (refreshToken: string) =>
    apiRequest<RefreshResult>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiRequest<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) =>
    apiRequest<MeResult>('/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
}
import { apiRequest } from '../auth'
