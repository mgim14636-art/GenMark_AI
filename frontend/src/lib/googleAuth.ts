declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (container: HTMLElement, options: { type: string }) => void
        }
      }
    }
  }
}

let sdkLoadPromise: Promise<void> | null = null

function loadGsiSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services를 불러오지 못했어요.'))
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

let initialized = false
let currentHiddenButton: HTMLElement | null = null
const googleClientId = import.meta.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID

// initialize()'s callback is fixed at init time, so route every call's
// resolve/reject through these module-level refs instead of re-initializing
// per call (re-initializing resets Google's internal config).
let currentResolve: ((idToken: string) => void) | null = null
let currentReject: ((error: unknown) => void) | null = null

const RESPONSE_TIMEOUT_MS = 60_000

function settleCurrent(idToken: string | null, error?: unknown) {
  if (idToken !== null) {
    currentResolve?.(idToken)
  } else {
    currentReject?.(error ?? new Error('Google 로그인이 취소되었거나 시간이 초과됐어요.'))
  }
  currentResolve = null
  currentReject = null
}

function ensureInitialized() {
  if (initialized) return
  const google = window.google
  if (!google) {
    throw new Error('Google Identity Services를 사용할 수 없어요.')
  }
  if (!googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID가 설정되지 않았습니다.')
  }
  google.accounts.id.initialize({
    client_id: googleClientId,
    // GIS has no explicit "user closed the popup" callback, so a plain
    // response-timeout is what actually unblocks a stuck login button if
    // the user dismisses Google's account chooser without picking one.
    callback: (response) => settleCurrent(response.credential),
  })
  initialized = true
}

// A rendered button goes stale after it's been used for a completed sign-in
// (Google tears down its internal iframe once the flow finishes), so a
// second login attempt reusing the same cached button finds nothing there.
// Render a fresh one on every attempt instead of caching across calls.
function createHiddenButton(): HTMLElement {
  currentHiddenButton?.remove()

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-9999px'
  container.style.opacity = '0'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)

  window.google!.accounts.id.renderButton(container, { type: 'standard' })
  currentHiddenButton = container
  return container
}

const BUTTON_READY_TIMEOUT_MS = 3_000
const BUTTON_POLL_INTERVAL_MS = 100

// renderButton() doesn't guarantee the inner div[role="button"] exists the
// instant it returns — Google finishes setting it up a beat later. Poll
// briefly instead of checking exactly once, so a real-but-slightly-late
// button doesn't get mistaken for a render failure.
function waitForRealButton(container: HTMLElement): Promise<HTMLElement | null> {
  const existing = container.querySelector<HTMLElement>('div[role="button"]')
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const start = Date.now()
    const timer = setInterval(() => {
      const found = container.querySelector<HTMLElement>('div[role="button"]')
      if (found || Date.now() - start >= BUTTON_READY_TIMEOUT_MS) {
        clearInterval(timer)
        resolve(found)
      }
    }, BUTTON_POLL_INTERVAL_MS)
  })
}

// Returns a Google **ID token** (JWT `credential`) — our backend verifies
// this via oauth2.googleapis.com/tokeninfo?id_token=..., which rejects an
// OAuth access token. Google's custom-button APIs don't officially support
// getting an id_token from an arbitrary click, so this forwards a real click
// to a hidden, real Google-rendered button (satisfies FedCM's user-gesture
// requirement since it's a genuine click landing on Google's own element).
export async function getGoogleIdToken(): Promise<string> {
  await loadGsiSdk()
  ensureInitialized()
  const button = createHiddenButton()
  const realButton = await waitForRealButton(button)

  return new Promise((resolve, reject) => {
    currentResolve = resolve
    currentReject = reject
    if (!realButton) {
      settleCurrent(null, new Error('Google 로그인 버튼을 준비하지 못했어요.'))
      return
    }
    realButton.click()
    setTimeout(() => settleCurrent(null), RESPONSE_TIMEOUT_MS)
  })
}
