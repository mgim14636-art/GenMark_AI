package com.genmark.ai.web.controller;

import com.genmark.ai.entity.Member;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.AuthService;
import com.genmark.ai.service.ProjectService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.project.ProjectResponse;
import com.genmark.ai.web.dto.project.ProjectUpsertRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectApiController {
    private final ProjectService projectService;
    private final AuthService authService;

    @PostMapping
    public ResponseEntity<ApiSuccessResponse<ProjectResponse>> create(
            @AuthenticationPrincipal MemberPrincipal principal,
            @Valid @RequestBody ProjectUpsertRequest request) {
        Member member = authService.getMember(principal.id());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiSuccessResponse.of(projectService.create(principal.id(), member, request)));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<ProjectResponse>> get(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(projectService.get(projectId, principal.id())));
    }

    @PatchMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<ProjectResponse>> patch(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @Valid @RequestBody ProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(projectService.update(projectId, principal.id(), request)));
    }

    @PutMapping({"/{projectId}/brand-brief", "/{projectId}/tone", "/{projectId}/logo-style", "/{projectId}/final-review"})
    public ResponseEntity<ApiSuccessResponse<ProjectResponse>> updateStep(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @Valid @RequestBody ProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(projectService.update(projectId, principal.id(), request)));
    }
}
