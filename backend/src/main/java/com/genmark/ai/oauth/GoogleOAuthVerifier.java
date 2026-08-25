package com.genmark.ai.oauth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * frontend/src/lib/googleAuth.ts가 발급하는 Google ID Token(JWT credential)을
 * Google의 tokeninfo 엔드포인트로 검증한다. 프론트 주석에도 명시된 방식이다:
 * "oauth2.googleapis.com/tokeninfo?id_token=...", 이 엔드포인트는 OAuth access token은 거부한다.
 */
@Component
public class GoogleOAuthVerifier implements OAuthVerifier {
    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthVerifier.class);

    private final RestClient restClient;
    private final String expectedClientId;

    public GoogleOAuthVerifier(
            RestClient oauthRestClient,
            @Value("${oauth.google.client-id:}") String expectedClientId
    ) {
        this.restClient = oauthRestClient;
        this.expectedClientId = expectedClientId;
    }

    @Override
    public String provider() {
        return "google";
    }

    @Override
    public OAuthUserInfo verify(String idToken) {
        TokenInfo tokenInfo;
        try {
            tokenInfo = restClient.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={idToken}", idToken)
                    .retrieve()
                    .body(TokenInfo.class);
        } catch (RestClientException e) {
            log.warn("Google tokeninfo 호출 실패: {}", e.toString());
            throw new ApiException(ErrorCode.OAUTH_VERIFICATION_FAILED, "구글 idToken 검증에 실패했습니다.");
        }

        if (tokenInfo == null || tokenInfo.sub() == null) {
            throw new ApiException(ErrorCode.OAUTH_VERIFICATION_FAILED, "구글 idToken 응답이 올바르지 않습니다.");
        }
        // GOOGLE_CLIENT_ID가 설정되지 않은 환경(로컬 초기 셋업)에서는 aud 검사를 건너뛴다.
        if (!expectedClientId.isBlank() && !expectedClientId.equals(tokenInfo.aud())) {
            throw new ApiException(ErrorCode.OAUTH_VERIFICATION_FAILED, "구글 idToken의 발급 대상(aud)이 일치하지 않습니다.");
        }

        String name = tokenInfo.name() != null ? tokenInfo.name() : tokenInfo.email();
        return new OAuthUserInfo("google", tokenInfo.sub(), tokenInfo.email(), name);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenInfo(String sub, String aud, String email, String name) {
    }
}
