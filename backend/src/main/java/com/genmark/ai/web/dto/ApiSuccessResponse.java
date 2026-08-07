package com.genmark.ai.web.dto;

/** API_SPEC.md 2.2 공통 성공 응답 포맷: {"data": {...}, "meta": {...}} */
public record ApiSuccessResponse<T>(T data, ApiMeta meta) {

    public static <T> ApiSuccessResponse<T> of(T data) {
        return new ApiSuccessResponse<>(data, ApiMeta.now());
    }
}
