package com.genmark.ai.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.web.dto.ApiErrorBody;
import com.genmark.ai.web.dto.ApiErrorResponse;
import com.genmark.ai.web.dto.ApiMeta;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

/** /api/v1/** 경로에서 권한 부족(403)일 때 API_SPEC.md 2.3 포맷으로 응답한다. */
@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public ApiAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        ApiMeta meta = ApiMeta.now();
        ApiErrorBody body = new ApiErrorBody("AUTH_REQUIRED", "접근 권한이 없습니다.", List.of(), meta.requestId());

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), new ApiErrorResponse(body));
    }
}
