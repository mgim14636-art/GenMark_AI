package com.genmark.ai.web.dto.auth;

import jakarta.validation.constraints.NotBlank;

/** frontend/src/lib/authApi.ts authApi.login()이 보내는 요청 바디와 1:1 대응. */
public record LoginRequest(
        @NotBlank(message = "provider는 필수입니다.") String provider,
        @NotBlank(message = "idToken은 필수입니다.") String idToken,
        String redirectUri
) {
}
