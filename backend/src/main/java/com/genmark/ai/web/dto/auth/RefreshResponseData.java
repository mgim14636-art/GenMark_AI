package com.genmark.ai.web.dto.auth;

/** frontend/src/lib/authApi.ts의 RefreshResult와 1:1 대응. */
public record RefreshResponseData(String accessToken, String refreshToken, long expiresIn) {
}
