package com.genmark.ai.web.exception;

import com.genmark.ai.web.dto.ApiErrorBody;
import com.genmark.ai.web.dto.ApiErrorDetail;
import com.genmark.ai.web.dto.ApiErrorResponse;
import com.genmark.ai.web.dto.ApiMeta;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/**
 * com.genmark.ai.web.controller 패키지(신규 /api/v1 컨트롤러)에만 적용되는 예외 처리기.
 * 레거시 Thymeleaf 컨트롤러는 기존 {@link com.genmark.ai.exception.GlobalExceptionHandler}를 그대로 사용한다.
 *
 * 두 advice 모두 Exception.class 폴백 핸들러를 갖고 있어서, 이 클래스가 적용되는 컨트롤러에
 * 대해서는 항상 이 클래스가 먼저 선택되도록 최우선 순위를 준다 (안 그러면 advice 선택 순서가
 * 정해져 있지 않아 레거시 {success,message,data} 포맷으로 응답될 수 있다).
 *
 * 인증 필터 단계(JWT 파싱 실패, 미인증 접근)에서 발생하는 401/403은 여기서 잡히지 않는다.
 * Spring Security의 필터 체인은 DispatcherServlet 이전에 동작하므로, 이 경우는
 * SecurityConfig에 등록한 ApiAuthenticationEntryPoint/ApiAccessDeniedHandler가 처리한다.
 */
@RestControllerAdvice(basePackages = "com.genmark.ai.web.controller")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex) {
        return buildResponse(ex.getErrorCode(), ex.getMessage(), ex.getDetails());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiErrorDetail> details = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> new ApiErrorDetail(fieldError.getField(), fieldError.getDefaultMessage()))
                .toList();
        return buildResponse(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.getDefaultMessage(), details);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex) {
        return buildResponse(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getDefaultMessage(), List.of());
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(ErrorCode code, String message, List<ApiErrorDetail> details) {
        ApiMeta meta = ApiMeta.now();
        ApiErrorBody body = new ApiErrorBody(code.name(), message, details, meta.requestId());
        return ResponseEntity.status(code.getHttpStatus()).body(new ApiErrorResponse(body));
    }
}
