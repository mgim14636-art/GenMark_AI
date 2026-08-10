package com.genmark.ai.web.controller;

import com.genmark.ai.entity.Member;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.AuthService;
import com.genmark.ai.service.CiProjectService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
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
