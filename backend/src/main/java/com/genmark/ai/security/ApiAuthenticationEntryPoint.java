package com.genmark.ai.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.web.dto.ApiErrorBody;
import com.genmark.ai.web.dto.ApiErrorResponse;
import com.genmark.ai.web.dto.ApiMeta;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

/** /api/v1/** 경로에서 인증 없이/잘못된 토큰으로 접근했을 때 API_SPEC.md 2.3 포맷으로 401을 내려준다. */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        boolean expired = "TOKEN_EXPIRED".equals(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE));

        String code = expired ? "TOKEN_EXPIRED" : "AUTH_REQUIRED";
        String message = expired ? "액세스 토큰이 만료되었습니다." : "로그인이 필요합니다.";

        ApiMeta meta = ApiMeta.now();
        ApiErrorBody body = new ApiErrorBody(code, message, List.of(), meta.requestId());

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), new ApiErrorResponse(body));
    }
}
