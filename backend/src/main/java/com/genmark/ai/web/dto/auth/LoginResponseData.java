package com.genmark.ai.web.dto.auth;

/** frontend/src/lib/authApi.ts의 LoginResult와 1:1 대응. */
public record LoginResponseData(
        String accessToken,
        String refreshToken,
        long expiresIn,
        UserSummaryResponse user,
        String resumeProjectId
) {
}
