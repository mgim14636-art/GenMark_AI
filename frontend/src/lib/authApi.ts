export type AuthProviderName = 'kakao' | 'google' | 'fake'

export interface UserSummary {
  id: string
  email: string
  name: string
  provider: AuthProviderName
  isFirstLogin: boolean
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

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const error = body?.error
    throw new ApiError(
      error?.message ?? '요청에 실패했어요.',
      error?.code ?? 'UNKNOWN',
      error?.requestId,
      error?.details,
    )
  }

  return body.data as T
}

export const authApi = {
  login: (provider: AuthProviderName, idToken: string, redirectUri?: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ provider, idToken, redirectUri }),
    }),

  refresh: (refreshToken: string) =>
    request<RefreshResult>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) =>
    request<MeResult>('/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
}
