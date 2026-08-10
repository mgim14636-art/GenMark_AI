package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.LogoGenerationService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.logo.LogoCandidateResponse;
import com.genmark.ai.web.dto.logo.LogoGenerationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/projects/{projectId}")
@RequiredArgsConstructor
public class LogoGenerationController {
    private final LogoGenerationService service;

    @PostMapping("/logo-generations")
    public ResponseEntity<ApiSuccessResponse<LogoGenerationResponse>> create(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiSuccessResponse.of(service.create(projectId, principal.id(), idempotencyKey)));
    }

    @GetMapping("/logo-generations/{generationId}")
    public ResponseEntity<ApiSuccessResponse<LogoGenerationResponse>> get(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String generationId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.get(projectId, generationId, principal.id())));
    }

    @GetMapping("/logo-candidates")
    public ResponseEntity<ApiSuccessResponse<List<LogoCandidateResponse>>> candidates(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.candidates(projectId, principal.id())));
    }

    @GetMapping("/logo-generations/{generationId}/logo-candidates")
    public ResponseEntity<ApiSuccessResponse<List<LogoCandidateResponse>>> generationCandidates(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String generationId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                service.candidates(projectId, generationId, principal.id())));
    }

    @PostMapping("/logo-candidates/{candidateId}/select")
    public ResponseEntity<ApiSuccessResponse<LogoCandidateResponse>> select(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String candidateId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.select(projectId, candidateId, principal.id())));
    }
}
