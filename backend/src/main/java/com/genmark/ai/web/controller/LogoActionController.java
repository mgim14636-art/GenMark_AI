package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.BrandKitService;
import com.genmark.ai.service.LogoDownloadService;
import com.genmark.ai.service.LogoPinService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.brandkit.BrandKitResponse;
import com.genmark.ai.web.dto.brandkit.BrandKitCreateRequest;
import jakarta.validation.Valid;
import com.genmark.ai.web.dto.logo.LogoDownloadResponse;
import com.genmark.ai.web.dto.logo.PinnedCandidateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.nio.charset.StandardCharsets;

/**
 * 생성된 로고에 대한 사용자 동작 — 찜(F12-3), 다운로드(F12-4), 브랜드킷(F14).
 *
 * <p>기존 {@link LogoGenerationController}와 같은 {@code /api/v1/projects/{projectId}} 아래에 둔다.
 * 로고 생성·조회와 성격이 달라 컨트롤러만 분리했다.
 *
 * <p>찜과 다운로드는 완전히 다른 동작이다. 찜은 3일 뒤 사라지는 임시 보류이고,
 * 다운로드는 파일을 보관하며 관리자 통계에 집계된다.
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/logo-candidates/{candidateId}")
@RequiredArgsConstructor
public class LogoActionController {

    private final LogoPinService pinService;
    private final LogoDownloadService downloadService;
    private final BrandKitService brandKitService;

    /** F12-3 찜 등록. 이미 찜한 로고를 다시 찜하면 보관 기간이 3일로 연장된다. */
    @PostMapping("/pin")
    public ResponseEntity<ApiSuccessResponse<PinnedCandidateResponse>> pin(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                pinService.pin(projectId, candidateId, principal.id())));
    }

    /** F12-3 찜 해제. */
    @DeleteMapping("/pin")
    public ResponseEntity<Void> unpin(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId) {
        pinService.unpin(projectId, candidateId, principal.id());
        return ResponseEntity.noContent().build();
    }

    /**
     * F12-4 다운로드 기록.
     *
     * <p>같은 로고를 다시 요청해도 횟수는 늘지 않고, 응답의 {@code firstTime}이 false로 온다.
     * 실제 이미지 파일은 응답의 {@code imageUrl}로 받는다.
     */
    @PostMapping("/download")
    public ResponseEntity<ApiSuccessResponse<LogoDownloadResponse>> download(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiSuccessResponse.of(
                downloadService.download(projectId, candidateId, principal.id())));
    }

    /**
     * F14 브랜드킷 생성 요청. CI면 명함, BI면 제품 썸네일이 만들어진다.
     *
     * <p>비동기라 202로 QUEUED 상태가 먼저 돌아온다. 완료 여부는 조회 API로 확인해야 한다.
     * <b>AI 서버에 해당 엔드포인트가 아직 없어 현재는 FAILED로 끝난다.</b>
     */
    @PostMapping("/brand-kits")
    public ResponseEntity<ApiSuccessResponse<BrandKitResponse>> createBrandKit(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId,
            @Valid @RequestBody(required = false) BrandKitCreateRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiSuccessResponse.of(
                brandKitService.create(projectId, candidateId, principal.id(), request)));
    }

    /** F14 브랜드킷 목록. */
    @GetMapping("/brand-kits")
    public ResponseEntity<ApiSuccessResponse<List<BrandKitResponse>>> brandKits(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                brandKitService.list(projectId, candidateId, principal.id())));
    }

    @GetMapping("/brand-kits/{brandKitId}")
    public ResponseEntity<ApiSuccessResponse<BrandKitResponse>> brandKit(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId,
            @PathVariable String brandKitId) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                brandKitService.get(projectId, candidateId, brandKitId, principal.id())));
    }

    @GetMapping("/brand-kits/{brandKitId}/download")
    public ResponseEntity<byte[]> downloadBrandKit(
            @AuthenticationPrincipal MemberPrincipal principal,
            @PathVariable String projectId, @PathVariable String candidateId,
            @PathVariable String brandKitId) {
        BrandKitService.BrandKitArchive archive = brandKitService.downloadArchive(
                projectId, candidateId, brandKitId, principal.id());
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(archive.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(archive.bytes());
    }
}
