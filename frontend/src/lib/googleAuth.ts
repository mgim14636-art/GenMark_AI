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
let hiddenButtonEl: HTMLElement | null = null

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
  google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    // GIS has no explicit "user closed the popup" callback, so a plain
    // response-timeout is what actually unblocks a stuck login button if
    // the user dismisses Google's account chooser without picking one.
    callback: (response) => settleCurrent(response.credential),
  })
  initialized = true
}

function ensureHiddenButton(): HTMLElement {
  if (hiddenButtonEl) return hiddenButtonEl

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-9999px'
  container.style.opacity = '0'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)

  window.google!.accounts.id.renderButton(container, { type: 'standard' })
  hiddenButtonEl = container
  return container
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
  const button = ensureHiddenButton()

  return new Promise((resolve, reject) => {
    currentResolve = resolve
    currentReject = reject
    const realButton = button.querySelector<HTMLElement>('div[role="button"]')
    if (!realButton) {
      settleCurrent(null, new Error('Google 로그인 버튼을 준비하지 못했어요.'))
      return
    }
    realButton.click()
    setTimeout(() => settleCurrent(null), RESPONSE_TIMEOUT_MS)
  })
}
