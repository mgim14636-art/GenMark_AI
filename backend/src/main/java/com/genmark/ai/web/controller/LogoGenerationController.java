package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.LogoGenerationService;
import com.genmark.ai.service.LogoSvgService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.logo.LogoCandidateResponse;
import com.genmark.ai.web.dto.logo.LogoGenerationResponse;
import com.genmark.ai.web.dto.logo.LogoSvgUpdateRequest;
import jakarta.validation.Valid;
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
    private final LogoSvgService svgService;

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

    @GetMapping("/logo-candidates/{candidateId}")
    public ResponseEntity<ApiSuccessResponse<LogoCandidateResponse>> candidate(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String candidateId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                service.candidate(projectId, candidateId, principal.id())));
    }

    @PostMapping("/logo-candidates/{candidateId}/select")
    public ResponseEntity<ApiSuccessResponse<LogoCandidateResponse>> select(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String candidateId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.select(projectId, candidateId, principal.id())));
    }

    @GetMapping("/logo-candidates/{candidateId}/svg")
    public ResponseEntity<byte[]> svg(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String candidateId) {
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.valueOf("image/svg+xml"))
                .header("X-Content-Type-Options", "nosniff")
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        org.springframework.http.ContentDisposition.attachment()
                                .filename(candidateId + ".svg", java.nio.charset.StandardCharsets.UTF_8)
                                .build().toString())
                .body(svgService.read(projectId, candidateId, principal.id()));
    }

    @PutMapping("/logo-candidates/{candidateId}/svg")
    public ResponseEntity<Void> updateSvg(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String candidateId, @Valid @RequestBody LogoSvgUpdateRequest request) {
        svgService.saveEdited(projectId, candidateId, principal.id(), request.svg());
        return ResponseEntity.noContent().build();
    }
}
