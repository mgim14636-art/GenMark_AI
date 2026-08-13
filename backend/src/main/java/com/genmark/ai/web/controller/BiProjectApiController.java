package com.genmark.ai.web.controller;

import com.genmark.ai.entity.Member;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.AuthService;
import com.genmark.ai.service.BiProjectService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.project.BiProjectResponse;
import com.genmark.ai.web.dto.project.BiProjectUpsertRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bi-projects")
@RequiredArgsConstructor
public class BiProjectApiController {
    private final BiProjectService biProjectService;
    private final AuthService authService;

    @PostMapping
    public ResponseEntity<ApiSuccessResponse<BiProjectResponse>> create(
            @AuthenticationPrincipal MemberPrincipal principal,
            @Valid @RequestBody BiProjectUpsertRequest request) {
        Member member = authService.getMember(principal.id());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiSuccessResponse.of(biProjectService.create(member, request)));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<BiProjectResponse>> get(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(biProjectService.get(projectId, principal.id())));
    }

    @PatchMapping("/{projectId}")
    public ResponseEntity<ApiSuccessResponse<BiProjectResponse>> patch(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @Valid @RequestBody BiProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(biProjectService.update(projectId, principal.id(), request)));
    }

    @PutMapping("/{projectId}/{step}")
    public ResponseEntity<ApiSuccessResponse<BiProjectResponse>> updateStep(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String step, @Valid @RequestBody BiProjectUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                biProjectService.updateStep(projectId, principal.id(), step, request)));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        biProjectService.delete(projectId, principal.id());
        return ResponseEntity.noContent().build();
    }
}
