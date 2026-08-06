package com.genmark.ai.oauth;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 실제 구글/카카오 앱 키 없이 로컬 개발에서 로그인 전체 흐름을 검증하기 위한 provider.
 * frontend/src/lib/authApi.ts의 AuthProviderName에도 'fake'가 포함되어 있다.
 * app.auth.fake-provider-enabled=false인 환경(운영 등)에서는 항상 실패한다.
 */
@Component
public class FakeOAuthVerifier implements OAuthVerifier {

    private final boolean enabled;

    public FakeOAuthVerifier(@Value("${app.auth.fake-provider-enabled:false}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public String provider() {
        return "fake";
    }

    @Override
    public OAuthUserInfo verify(String token) {
        if (!enabled) {
            throw new ApiException(ErrorCode.PROVIDER_NOT_SUPPORTED, "fake provider는 이 환경에서 비활성화되어 있습니다.");
        }
        if (token == null || token.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "fake provider는 idToken 값을 사용자 식별자로 사용합니다.");
        }

        String providerId = token.trim();
        return new OAuthUserInfo(
                "fake",
                providerId,
                "fake+" + providerId + "@genmark.local",
                "Fake User " + providerId
        );
    }
}
