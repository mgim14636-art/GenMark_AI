package com.genmark.ai.web.controller;

import com.genmark.ai.entity.Member;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.AuthService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.auth.LoginRequest;
import com.genmark.ai.web.dto.auth.LoginResponseData;
import com.genmark.ai.web.dto.auth.MeResponseData;
import com.genmark.ai.web.dto.auth.RefreshResponseData;
import com.genmark.ai.web.dto.auth.RefreshTokenRequest;
import com.genmark.ai.web.dto.auth.UserSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API_SPEC.md 5.1 인증 API 구현체.
 * frontend/src/lib/authApi.ts가 그대로 소비할 수 있는 필드명을 사용한다.
 */
@RestController
@RequestMapping("/api/v1")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<ApiSuccessResponse<LoginResponseData>> login(@Valid @RequestBody LoginRequest request) {
        AuthService.LoginResult result = authService.login(request.provider(), request.idToken());

        UserSummaryResponse user = toUserSummary(result.member(), result.isFirstLogin());
        String resumeProjectId = result.resumeProjectId() == null ? null : String.valueOf(result.resumeProjectId());
        LoginResponseData data = new LoginResponseData(
                result.accessToken(), result.refreshToken(), result.expiresIn(), user, resumeProjectId);

        return ResponseEntity.ok(ApiSuccessResponse.of(data));
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<ApiSuccessResponse<RefreshResponseData>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthService.RefreshResult result = authService.refresh(request.refreshToken());
        RefreshResponseData data = new RefreshResponseData(result.accessToken(), result.refreshToken(), result.expiresIn());
        return ResponseEntity.ok(ApiSuccessResponse.of(data));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<ApiSuccessResponse<MeResponseData>> me(@AuthenticationPrincipal MemberPrincipal principal) {
        Member member = authService.getMember(principal.id());
        UserSummaryResponse user = toUserSummary(member, false);
        return ResponseEntity.ok(ApiSuccessResponse.of(new MeResponseData(user, null)));
    }

    private UserSummaryResponse toUserSummary(Member member, boolean isFirstLogin) {
        return new UserSummaryResponse(
                String.valueOf(member.getId()),
                member.getEmail(),
                member.getName(),
                member.getProvider(),
                isFirstLogin
        );
    }
}
