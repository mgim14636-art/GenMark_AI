export type AuthPopupCallbacks<T> = {
  success: (value: T) => void
  fail: (error?: unknown) => void
}

export class AuthPopupError extends Error {
  code: 'LOGIN_CANCELLED' | 'LOGIN_TIMEOUT'

  constructor(code: 'LOGIN_CANCELLED' | 'LOGIN_TIMEOUT', message: string) {
    super(message)
    this.name = 'AuthPopupError'
    this.code = code
  }
}

const POPUP_POLL_INTERVAL_MS = 250
// OAuth providers can close the popup immediately before delivering their
// success callback to the opener. Give that callback a short grace period
// before treating the close as an explicit cancellation.
const POPUP_CLOSE_GRACE_MS = 1_500
const POPUP_TIMEOUT_MS = 60_000

export function runAuthPopup<T>(
  start: (callbacks: AuthPopupCallbacks<T>) => void,
  providerLabel: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let popup: Window | null = null
    let settled = false
    let pollTimer: number | null = null
    let closeTimer: number | null = null
    let timeoutTimer: number | null = null
    const originalOpen = window.open
    const callOriginalOpen = originalOpen.bind(window)

    const cleanup = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer)
      if (closeTimer !== null) window.clearTimeout(closeTimer)
      if (timeoutTimer !== null) window.clearTimeout(timeoutTimer)
      if (window.open === wrappedOpen) window.open = originalOpen
    }

    const succeed = (value: T) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = (error?: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const wrappedOpen = ((url?: string | URL, target?: string, features?: string) => {
      popup = callOriginalOpen(url, target, features)
      return popup
    }) as typeof window.open

    window.open = wrappedOpen
    pollTimer = window.setInterval(() => {
      if (popup?.closed && closeTimer === null) {
        closeTimer = window.setTimeout(() => {
          fail(new AuthPopupError('LOGIN_CANCELLED', `${providerLabel} 로그인이 취소되었습니다.`))
        }, POPUP_CLOSE_GRACE_MS)
      }
    }, POPUP_POLL_INTERVAL_MS)
    timeoutTimer = window.setTimeout(() => {
      fail(new AuthPopupError('LOGIN_TIMEOUT', `${providerLabel} 로그인 응답 시간이 초과되었습니다.`))
    }, POPUP_TIMEOUT_MS)

    try {
      start({ success: succeed, fail })
    } catch (error) {
      fail(error)
    }
  })
}
