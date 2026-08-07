package com.genmark.ai.oauth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * frontend/src/lib/kakaoAuth.ts는 Kakao.Auth.login()이 돌려주는 OAuth access token을
 * 그대로 LoginRequest.idToken 필드에 담아 보낸다 (OIDC id_token이 아니다).
 * 백엔드는 이 값을 Authorization: Bearer로 kapi.kakao.com/v2/user/me에 전달해 사용자 정보를 확인한다.
 */
@Component
public class KakaoOAuthVerifier implements OAuthVerifier {

    private final RestClient restClient;

    public KakaoOAuthVerifier(RestClient oauthRestClient) {
        this.restClient = oauthRestClient;
    }

    @Override
    public String provider() {
        return "kakao";
    }

    @Override
    public OAuthUserInfo verify(String accessToken) {
        KakaoUserResponse response;
        try {
            response = restClient.get()
                    .uri("https://kapi.kakao.com/v2/user/me")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(KakaoUserResponse.class);
        } catch (RestClientException e) {
            throw new ApiException(ErrorCode.OAUTH_VERIFICATION_FAILED, "카카오 액세스 토큰 검증에 실패했습니다.");
        }

        if (response == null || response.id() == null) {
            throw new ApiException(ErrorCode.OAUTH_VERIFICATION_FAILED, "카카오 사용자 정보 응답이 올바르지 않습니다.");
        }

        String email = response.kakaoAccount() != null ? response.kakaoAccount().email() : null;
        String nickname = resolveNickname(response);

        return new OAuthUserInfo("kakao", String.valueOf(response.id()), email, nickname);
    }

    private String resolveNickname(KakaoUserResponse response) {
        if (response.kakaoAccount() != null && response.kakaoAccount().profile() != null
                && response.kakaoAccount().profile().nickname() != null) {
            return response.kakaoAccount().profile().nickname();
        }
        if (response.properties() != null && response.properties().nickname() != null) {
            return response.properties().nickname();
        }
        return "카카오 사용자";
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record KakaoUserResponse(
            Long id,
            @JsonProperty("kakao_account") KakaoAccount kakaoAccount,
            Properties properties
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record KakaoAccount(String email, Profile profile) {
            @JsonIgnoreProperties(ignoreUnknown = true)
            record Profile(String nickname) {
            }
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        record Properties(String nickname) {
        }
    }
}
