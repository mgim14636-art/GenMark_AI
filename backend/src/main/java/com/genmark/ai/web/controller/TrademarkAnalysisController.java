package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.TrademarkAnalysisService;
import com.genmark.ai.service.TrademarkMatchImageService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.trademark.TrademarkAnalysisResponse;
import com.genmark.ai.web.dto.trademark.TrademarkMatchResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/projects/{projectId}")
@RequiredArgsConstructor
public class TrademarkAnalysisController {
    private final TrademarkAnalysisService service;
    private final TrademarkMatchImageService imageService;

    @PostMapping("/trademark-analyses")
    public ResponseEntity<ApiSuccessResponse<TrademarkAnalysisResponse>> create(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiSuccessResponse.of(service.create(projectId, principal.id())));
    }

    @GetMapping("/trademark-analyses/{analysisId}")
    public ResponseEntity<ApiSuccessResponse<TrademarkAnalysisResponse>> get(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String analysisId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.get(projectId, analysisId, principal.id())));
    }

    @GetMapping("/trademark-analyses/{analysisId}/matches")
    public ResponseEntity<ApiSuccessResponse<List<TrademarkMatchResponse>>> matches(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String analysisId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(service.matches(projectId, analysisId, principal.id())));
    }

    @GetMapping("/trademark-analyses/{analysisId}/matches/{rank}/image")
    public ResponseEntity<byte[]> matchImage(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String projectId,
            @PathVariable String analysisId, @PathVariable int rank) {
        TrademarkMatchImageService.ImageContent image = imageService.load(projectId, analysisId, rank, principal.id());
        ContentDisposition disposition = ContentDisposition.inline()
                .filename(image.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(image.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(image.bytes());
    }
}
