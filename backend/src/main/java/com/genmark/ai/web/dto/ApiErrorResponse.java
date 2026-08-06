package com.genmark.ai.web.dto;

/** API_SPEC.md 2.3 공통 오류 응답 포맷: {"error": {"code","message","details","requestId"}} */
public record ApiErrorResponse(ApiErrorBody error) {
}
