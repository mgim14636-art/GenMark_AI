package com.genmark.ai.web.dto.auth;

/** frontend/src/lib/authApi.ts의 UserSummary와 1:1 대응 (id는 문자열로 내려준다). */
public record UserSummaryResponse(
        String id,
        String email,
        String name,
        String provider,
        boolean isFirstLogin
) {
}
