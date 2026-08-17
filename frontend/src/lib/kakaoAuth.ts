import { runAuthPopup } from './authPopup'

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void
      isInitialized: () => boolean
      Auth: {
        login: (options: {
          success: (authObj: { access_token: string }) => void
          fail: (error: unknown) => void
        }) => void
      }
    }
  }
}

let sdkLoadPromise: Promise<void> | null = null

function loadKakaoSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Kakao) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요.'))
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

// Returns Kakao's OAuth **access token** — our backend forwards this as
// `Authorization: Bearer` to kapi.kakao.com/v2/user/me, it does NOT expect an
// OIDC id_token here despite the wire field being named "idToken".
export async function getKakaoAccessToken(): Promise<string> {
  await loadKakaoSdk()
  const Kakao = window.Kakao
  if (!Kakao) {
    throw new Error('카카오 SDK를 사용할 수 없어요.')
  }
  if (!Kakao.isInitialized()) {
    const key = import.meta.env.VITE_KAKAO_JS_KEY
    if (!key) {
      throw new Error('Kakao JavaScript 키가 필요합니다. KAKAO_REST_API_KEY는 브라우저 SDK에 사용할 수 없습니다.')
    }
    Kakao.init(key)
  }

  return runAuthPopup(({ success, fail }) => {
    Kakao.Auth.login({
      success: (authObj) => success(authObj.access_token),
      fail,
    })
  }, '카카오')
}
