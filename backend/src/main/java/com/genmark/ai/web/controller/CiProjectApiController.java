package com.genmark.ai.web.controller;

import com.genmark.ai.entity.Member;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.AuthService;
import com.genmark.ai.service.CiProjectService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.project.CiLatestProfileResponse;
import com.genmark.ai.web.dto.project.CiProjectResponse;
import com.genmark.ai.web.dto.project.CiProjectUpsertRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ci-projects")
@RequiredArgsConstructor
public class CiProjectApiController {
    private final CiProjectService ciProjectService;
    private final AuthService authService;

    @PostMapping
    public ResponseEntity<ApiSuccessResponse<CiProjectResponse>> create(
            @AuthenticationPrincipal MemberPrincipal principal,
            @Valid @RequestBody CiProjectUpsertRequest request) {
        Member member = authService.getMember(principal.id());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiSuccessResponse.of(ciProjectService.create(member, request)));
    }

    /**
     * F7-1 CI 자동 채움: 직전에 만든 CI의 회사명·핵심가치를 돌려준다.
     *
     * <p>화면은 두 번째 CI부터 이 값을 미리 채워 보여주고, 사용자가 그대로 두면 그대로 저장한다.
     * 첫 CI라면 {@code hasPrevious=false}가 오므로 빈 화면으로 시작하면 된다.
     *
     * <p>BI에는 이 규칙이 없어 대응 엔드포인트를 두지 않았다.
     *
     * <p>경로가 {@code /{projectId}}보다 먼저 선언돼 있지 않아도, 스프링은 변수보다
     * 고정 문자열 경로를 우선 매칭하므로 "latest-profile"이 projectId로 잡히지 않는다.
     */
    @GetMapping("/latest-profile")
    public ResponseEntity<ApiSuccessResponse<CiLatestProfileResponse>> latestProfile(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(ciProjectService.latestProfile(principal.id())));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<CiProjectResponse>> get(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(ciProjectService.get(projectId, principal.id())));
    }

    @PatchMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<CiProjectResponse>> patch(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @Valid @RequestBody CiProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(ciProjectService.update(projectId, principal.id(), request)));
    }

    @PutMapping("/{projectId}/{step}")
    public ResponseEntity<ApiSuccessResponse<CiProjectResponse>> updateStep(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String step, @Valid @RequestBody CiProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                ciProjectService.updateStep(projectId, principal.id(), step, request)));
    }
}
