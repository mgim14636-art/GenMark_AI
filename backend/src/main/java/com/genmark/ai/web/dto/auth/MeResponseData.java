package com.genmark.ai.web.dto.auth;

/** frontend/src/lib/authApi.ts의 MeResult와 1:1 대응. */
public record MeResponseData(UserSummaryResponse user, String resumeProjectId) {
}
