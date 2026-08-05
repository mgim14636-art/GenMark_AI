export type AuthProvider = 'kakao' | 'google'

export type AuthUser = {
  id: string
  email: string
  name: string
  provider: AuthProvider
  isFirstLogin: boolean
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
type ApiErrorPayload = { error?: { code?: string; message?: string } }
type KakaoSdk = { isInitialized: () => boolean; init: (key: string) => void; Auth: { login: (options: { success: (response: { access_token: string }) => void; fail: () => void }) => void } }
type GoogleSdk = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void; error_callback?: () => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } } } }

declare global {
  interface Window { Kakao?: KakaoSdk; google?: GoogleSdk }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '')
const REFRESH_TOKEN_KEY = 'genmark.refresh-token'
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js'
const GOOGLE_SDK_URL = 'https://accounts.google.com/gsi/client'
let accessToken: string | null = null

export class AuthError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'AUTH_ERROR', status = 0) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

const getRefreshToken = () => window.localStorage.getItem(REFRESH_TOKEN_KEY)
const clearTokens = () => { accessToken = null; window.localStorage.removeItem(REFRESH_TOKEN_KEY) }
const saveTokens = (tokens: TokenResponse) => { accessToken = tokens.accessToken; window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken) }

const loadScript = (id: string, src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.getElementById(id)
  if (existing) { resolve(); return }
  const script = document.createElement('script')
  script.id = id
  script.src = src
  script.async = true
  script.onload = () => resolve()
  script.onerror = () => reject(new AuthError('로그인 SDK를 불러오지 못했습니다.', 'SDK_LOAD_FAILED'))
  document.head.appendChild(script)
})

const parsePayload = async (response: Response): Promise<unknown> => response.status === 204 ? undefined : response.json().catch(() => undefined)

const requestRaw = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  return { response, payload: await parsePayload(response) }
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  const { response, payload } = await requestRaw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) })
  if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload)) { clearTokens(); return false }
  saveTokens((payload as { data: TokenResponse }).data)
  return true
}

const request = async <T>(path: string, init: RequestInit = {}, retry = true): Promise<T> => {
  const { response, payload } = await requestRaw(path, init)
  const errorPayload = payload as ApiErrorPayload | undefined
  if (response.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await refreshAccessToken()) return request<T>(path, init, false)
    clearTokens()
  }
  if (!response.ok) throw new AuthError(errorPayload?.error?.message ?? '인증 요청에 실패했습니다.', errorPayload?.error?.code ?? 'AUTH_ERROR', response.status)
  return (payload as { data: T } | undefined)?.data as T
}

const getKakaoToken = async () => {
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key) throw new AuthError('VITE_KAKAO_JS_KEY가 설정되지 않았습니다.', 'AUTH_CONFIG_MISSING')
  await loadScript('kakao-sdk', KAKAO_SDK_URL)
  const kakao = window.Kakao
  if (!kakao) throw new AuthError('카카오 로그인 SDK를 사용할 수 없습니다.', 'SDK_UNAVAILABLE')
  if (!kakao.isInitialized()) kakao.init(key)
  return new Promise<string>((resolve, reject) => kakao.Auth.login({ success: (response) => resolve(response.access_token), fail: () => reject(new AuthError('카카오 로그인이 취소되었거나 실패했습니다.', 'PROVIDER_LOGIN_FAILED')) }))
}

const getGoogleToken = async () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new AuthError('VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.', 'AUTH_CONFIG_MISSING')
  await loadScript('google-sdk', GOOGLE_SDK_URL)
  const google = window.google
  if (!google) throw new AuthError('Google 로그인 SDK를 사용할 수 없습니다.', 'SDK_UNAVAILABLE')
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => response.access_token ? resolve(response.access_token) : reject(new AuthError('Google 로그인이 취소되었거나 실패했습니다.', response.error ?? 'PROVIDER_LOGIN_FAILED')),
      error_callback: () => reject(new AuthError('Google 로그인이 취소되었거나 실패했습니다.', 'PROVIDER_LOGIN_FAILED')),
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}

export const loginWithProvider = async (provider: AuthProvider) => {
  const idToken = provider === 'kakao' ? await getKakaoToken() : await getGoogleToken()
  const session = await request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ provider, idToken, redirectUri: window.location.origin }) }, false)
  saveTokens(session)
  return session
}

export const restoreSession = async () => {
  if (!getRefreshToken() || !(await refreshAccessToken())) return null
  return request<MeResponse>('/me')
}

export const logout = async () => {
  const refreshToken = getRefreshToken()
  try { if (refreshToken) await requestRaw('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }) }
  finally { clearTokens() }
}

export const apiRequest = request
