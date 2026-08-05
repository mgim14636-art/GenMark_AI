const REFRESH_TOKEN_KEY = 'genmark.refreshToken'

// accessToken is intentionally NOT stored here — it stays in React state only
// (see docs/AUTH_INTEGRATION.md §6: avoid persisting the bearer token where
// XSS could read it; refreshToken is opaque and rotates on every use).
export const tokenStorage = {
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clearRefreshToken: (): void => localStorage.removeItem(REFRESH_TOKEN_KEY),
}
