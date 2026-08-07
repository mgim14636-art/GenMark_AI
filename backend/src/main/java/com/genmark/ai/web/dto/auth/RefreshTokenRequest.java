package com.genmark.ai.web.dto.auth;

import jakarta.validation.constraints.NotBlank;

/** /auth/refresh, /auth/logout이 공유하는 { "refreshToken": "..." } 요청 바디. */
public record RefreshTokenRequest(
        @NotBlank(message = "refreshToken은 필수입니다.") String refreshToken
) {
}
