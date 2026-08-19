import { getGoogleIdToken } from './lib/googleAuth'
import { getKakaoAccessToken } from './lib/kakaoAuth'
import { AuthPopupError } from './lib/authPopup'
import { tokenStorage } from './lib/tokenStorage'

export type AuthProvider = 'kakao' | 'google'

export type AuthUser = {
  id: string
  email: string
  name: string
  provider: AuthProvider
  isFirstLogin: boolean
  onboardingCompleted: boolean
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
  resumeProjectId: string | null
}

type MeResponse = { user: AuthUser; resumeProjectId: string | null }
type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number }
type ApiErrorPayload = {
  error?: {
    code?: string
    message?: string
    requestId?: string
    details?: unknown[]
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
let accessToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

export class AuthError extends Error {
  code: string
  status: number
  requestId?: string
  details?: unknown[]

  constructor(message: string, code = 'AUTH_ERROR', status = 0, requestId?: string, details?: unknown[]) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

const getRefreshToken = () => tokenStorage.getRefreshToken()
const clearTokens = () => {
  accessToken = null
  tokenStorage.clearRefreshToken()
}
const saveTokens = (tokens: TokenResponse) => {
  accessToken = tokens.accessToken
  tokenStorage.setRefreshToken(tokens.refreshToken)
}

const parsePayload = async (response: Response): Promise<unknown> => (
  response.status === 204 ? undefined : response.json().catch(() => undefined)
)

const requestRaw = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  return { response, payload: await parsePayload(response) }
}

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false

    let response: Response
    let payload: unknown
    try {
      ({ response, payload } = await requestRaw('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }))
    } catch {
      // A backend restart or transient network failure must not destroy a
      // still-valid refresh token. The next request can retry the refresh.
      return false
    }

    if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload)) {
      // Only an explicit client/auth failure proves that the stored token is
      // unusable. Keep it across 5xx/proxy errors so a brief outage does not
      // turn into a permanent logout.
      if (response.status >= 400 && response.status < 500) clearTokens()
      return false
    }

    saveTokens((payload as { data: TokenResponse }).data)
    return true
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

const request = async <T>(path: string, init: RequestInit = {}, retry = true): Promise<T> => {
  const { response, payload } = await requestRaw(path, init)
  const errorPayload = payload as ApiErrorPayload | undefined

  if (response.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await refreshAccessToken()) return request<T>(path, init, false)
    clearTokens()
  }

  if (!response.ok) {
    throw new AuthError(
      errorPayload?.error?.message ?? '인증 요청에 실패했습니다.',
      errorPayload?.error?.code ?? 'AUTH_ERROR',
      response.status,
      errorPayload?.error?.requestId,
      errorPayload?.error?.details,
    )
  }

  return (payload as { data: T } | undefined)?.data as T
}

const normalizeProviderError = (error: unknown) => {
  if (error instanceof AuthError) return error
  if (error instanceof AuthPopupError) {
    return new AuthError(error.message, error.code)
  }
  const message = error instanceof Error ? error.message : '소셜 로그인에 실패했습니다.'
  return new AuthError(message, 'PROVIDER_LOGIN_FAILED')
}

const getKakaoToken = async () => {
  try {
    return await getKakaoAccessToken()
  } catch (error) {
    throw normalizeProviderError(error)
  }
}

const getGoogleToken = async () => {
  try {
    // Google must return an ID token (credential), not an OAuth access token.
    return await getGoogleIdToken()
  } catch (error) {
    throw normalizeProviderError(error)
  }
}

export const loginWithProvider = async (provider: AuthProvider) => {
  const idToken = provider === 'kakao' ? await getKakaoToken() : await getGoogleToken()
  const session = await request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ provider, idToken, redirectUri: window.location.origin }),
  }, false)

  saveTokens(session)
  return session
}

export const restoreSession = async () => {
  if (!getRefreshToken() || !(await refreshAccessToken())) return null
  return request<MeResponse>('/me')
}

export const logout = async () => {
  const refreshToken = getRefreshToken()
  clearTokens()

  // Local logout is completed immediately. The server request is only
  // best-effort cleanup and must not delay the UI transition.
  try {
    if (refreshToken) {
      await requestRaw('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    }
  } catch {
    // The session is already cleared locally, so a server-side failure does
    // not keep the user signed in or block the return to the current screen.
  }
}

export const apiRequest = request

export const apiRequestWithToken = async <T>(token: string, path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  const payload = await parsePayload(response)
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | undefined
    throw new AuthError(
      errorPayload?.error?.message ?? '관리자 요청에 실패했어요.',
      errorPayload?.error?.code ?? 'ADMIN_REQUEST_FAILED',
      response.status,
      errorPayload?.error?.requestId,
      errorPayload?.error?.details,
    )
  }
  return (payload as { data: T } | undefined)?.data as T
}

const resolveApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = API_BASE_URL.replace(/\/$/, '')
  if (normalizedPath.startsWith('/api/v1/')) {
    if (normalizedBase.startsWith('/')) return normalizedPath
    try { return new URL(normalizedPath, normalizedBase).toString() } catch { return normalizedPath }
  }
  return `${normalizedBase}${normalizedPath}`
}

const downloadFileWithToken = async (token: string | null, path: string, refresh = false): Promise<Blob> => {
  const doFetch = async () => fetch(resolveApiUrl(path), {
    headers: (token ?? accessToken) ? { Authorization: `Bearer ${token ?? accessToken}` } : undefined,
  })

  let response = await doFetch()
  if (refresh && response.status === 401 && await refreshAccessToken()) response = await doFetch()
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as ApiErrorPayload | undefined
    throw new AuthError(
      payload?.error?.message ?? '파일을 다운로드하지 못했어요.',
      payload?.error?.code ?? 'DOWNLOAD_FAILED',
      response.status,
      payload?.error?.requestId,
      payload?.error?.details,
    )
  }
  return response.blob()
}

export const downloadAuthenticatedFile = (path: string) => downloadFileWithToken(accessToken, path, true)
export const downloadAuthenticatedFileWithToken = (token: string, path: string) => downloadFileWithToken(token, path)

export const apiBlobRequest = async (imageUrl: string, retry = true): Promise<Blob> => {
  const headers = new Headers({ Accept: 'image/*' })
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(imageUrl, { headers })
  if (response.status === 401 && retry && await refreshAccessToken()) {
    return apiBlobRequest(imageUrl, false)
  }

  if (!response.ok) {
    throw new AuthError('상표 이미지를 불러오지 못했어요.', 'TRADEMARK_IMAGE_ERROR', response.status)
  }

  return response.blob()
}

export const apiTextRequest = async (url: string, init: RequestInit = {}, retry = true): Promise<string> => {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!headers.has('Accept')) headers.set('Accept', 'image/svg+xml, text/plain')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(url, { ...init, headers })
  if (response.status === 401 && retry && await refreshAccessToken()) {
    return apiTextRequest(url, init, false)
  }
  if (!response.ok) {
    throw new AuthError('SVG 파일을 처리하지 못했어요.', 'SVG_REQUEST_ERROR', response.status)
  }
  return response.text()
}
