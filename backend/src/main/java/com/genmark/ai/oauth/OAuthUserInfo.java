package com.genmark.ai.oauth;

/** provider 검증 성공 후 얻는 표준화된 사용자 정보. */
public record OAuthUserInfo(String provider, String providerId, String email, String name) {
}
