package com.genmark.ai.web.exception;

import org.springframework.http.HttpStatus;

/**
 * API_SPEC.md 8장 오류 코드 표를 기준으로 한다.
 * OAUTH_VERIFICATION_FAILED / PROVIDER_NOT_SUPPORTED / INTERNAL_ERROR는 표에는 없지만
 * 로그인 처리에 필요해서 추가한 코드다 (docs/AUTH_INTEGRATION.md에 명시).
 */
public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "요청값을 확인해주세요."),
    AUTH_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "액세스 토큰이 만료되었습니다."),
    OAUTH_VERIFICATION_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인 토큰을 확인할 수 없습니다."),
    PROVIDER_NOT_SUPPORTED(HttpStatus.BAD_REQUEST, "지원하지 않는 로그인 provider입니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
