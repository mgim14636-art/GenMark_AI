package com.genmark.ai.oauth;

/**
 * 프론트가 /auth/login에 보낸 토큰(구글은 idToken, 카카오는 accessToken)을 검증하고
 * provider 쪽 사용자 정보를 가져오는 인터페이스.
 */
public interface OAuthVerifier {

    /** AuthProviderName 값과 일치해야 한다 (frontend/src/lib/authApi.ts 참고): kakao | google | fake */
    String provider();

    /**
     * @param token LoginRequest.idToken 필드 값. provider에 따라 실제 의미가 다르다.
     * @throws com.genmark.ai.web.exception.ApiException 검증 실패 시 OAUTH_VERIFICATION_FAILED
     */
    OAuthUserInfo verify(String token);
}
