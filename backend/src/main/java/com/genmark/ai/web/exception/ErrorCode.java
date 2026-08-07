package com.genmark.ai.web.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "요청값을 확인해 주세요."),
    AUTH_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "토큰이 만료되었거나 유효하지 않습니다."),
    OAUTH_VERIFICATION_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인 토큰을 확인할 수 없습니다."),
    PROVIDER_NOT_SUPPORTED(HttpStatus.BAD_REQUEST, "지원하지 않는 로그인 제공자입니다."),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
    RESOURCE_CONFLICT(HttpStatus.CONFLICT, "현재 상태에서는 요청을 처리할 수 없습니다."),
    ONBOARDING_DETAILS_REQUIRED(HttpStatus.UNPROCESSABLE_ENTITY, "상세정보 제출 시 초기 프로젝트 정보가 필요합니다."),
    AI_UNAVAILABLE(HttpStatus.BAD_GATEWAY, "AI 서버 응답을 받을 수 없습니다."),
    AI_INVALID_RESPONSE(HttpStatus.BAD_GATEWAY, "AI 서버 응답 형식이 올바르지 않습니다."),
    AI_INCOMPLETE_RESULT(HttpStatus.BAD_GATEWAY, "AI가 로고 후보 4개를 반환하지 않았습니다."),
    STORAGE_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "이미지 파일을 저장하거나 읽을 수 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus getHttpStatus() { return httpStatus; }
    public String getDefaultMessage() { return defaultMessage; }
}
