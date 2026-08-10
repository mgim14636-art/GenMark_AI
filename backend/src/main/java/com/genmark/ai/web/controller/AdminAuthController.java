package com.genmark.ai.web.controller;

import com.genmark.ai.service.AdminAuthService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.admin.AdminLoginRequest;
import com.genmark.ai.web.dto.admin.AdminLoginResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 로그인 (F16-0). 이 경로만 토큰 없이 열려 있고, 나머지 /api/v1/admin/** 은
 * ROLE_ADMIN 토큰이 있어야 통과한다.
 *
 * <p>관리자 회원가입 API는 의도적으로 만들지 않았다. 계정은 DB에 직접 INSERT로 넣는다.
 */
@RestController
@RequestMapping("/api/v1/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @PostMapping("/login")
    public ResponseEntity<ApiSuccessResponse<AdminLoginResponse>> login(
            @Valid @RequestBody AdminLoginRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(adminAuthService.login(request)));
    }
}
