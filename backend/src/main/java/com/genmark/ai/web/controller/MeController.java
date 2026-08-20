package com.genmark.ai.web.controller;

import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.BrandKitService;
import com.genmark.ai.service.CreditService;
import com.genmark.ai.service.LogoDownloadService;
import com.genmark.ai.service.LogoPinService;
import com.genmark.ai.service.MypageAssetService;
import com.genmark.ai.service.SurveyService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.brandkit.BrandKitResponse;
import com.genmark.ai.web.dto.logo.LogoDownloadResponse;
import com.genmark.ai.web.dto.logo.PinnedCandidateResponse;
import com.genmark.ai.web.dto.survey.SurveyResponse;
import com.genmark.ai.web.dto.survey.SurveySubmitRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 로그인한 사용자 본인에 관한 조회 — 찜 목록, 다운로드 목록, 크레딧, 설문조사.
 *
 * <p>프로젝트 단위가 아니라 "내 것 전체"를 보는 화면에서 쓰인다.
 */
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class MeController {

    private final LogoPinService pinService;
    private final LogoDownloadService downloadService;
    private final CreditService creditService;
    private final SurveyService surveyService;
    private final BrandKitService brandKitService;
    private final MypageAssetService mypageAssetService;

    /** 내 찜 목록 (CI/BI 합쳐서 최근 찜한 순). 만료된 항목은 제외된다. */
    @GetMapping("/pins")
    public ResponseEntity<ApiSuccessResponse<List<PinnedCandidateResponse>>> pins(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(pinService.myPins(principal.id())));
    }

    /** 내 다운로드 목록. 종류(CI/BI)별로 최대 20개까지 보관된다. */
    @GetMapping("/downloads")
    public ResponseEntity<ApiSuccessResponse<List<LogoDownloadResponse>>> downloads(
            @AuthenticationPrincipal MemberPrincipal principal, @RequestParam String type) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                downloadService.myDownloads(principal.id(), parseType(type))));
    }

    /** 다운로드한 로고의 실제 이미지. 본인 것만 볼 수 있다. */
    @GetMapping("/downloads/{downloadId}/image")
    public ResponseEntity<byte[]> downloadImage(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable Long downloadId) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(downloadService.readImage(downloadId, principal.id()));
    }

    /** 다운로드 보관 자산 삭제. */
    @DeleteMapping("/downloads/{downloadId}")
    public ResponseEntity<Void> deleteDownload(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable Long downloadId) {
        downloadService.delete(downloadId, principal.id());
        return ResponseEntity.noContent().build();
    }

    /** 생성 로고 중 마이페이지 목록에서 삭제한 후보 ID. 원본 프로젝트는 유지된다. */
    @GetMapping("/assets/hidden-logo-candidates")
    public ResponseEntity<ApiSuccessResponse<List<String>>> hiddenLogoCandidateIds(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(mypageAssetService.hiddenLogoCandidateIds(principal.id())));
    }

    /** 생성 로고를 마이페이지 자산 목록에서만 삭제한다. */
    @DeleteMapping("/assets/hidden-logo-candidates/{candidateId}")
    public ResponseEntity<Void> hideLogo(
            @AuthenticationPrincipal MemberPrincipal principal, @PathVariable String candidateId) {
        mypageAssetService.hideLogo(candidateId, principal.id());
        return ResponseEntity.noContent().build();
    }

    /** 남은 크레딧. 화면 상단 표시용. */
    @GetMapping("/credits")
    public ResponseEntity<ApiSuccessResponse<Map<String, Integer>>> credits(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                Map.of("balance", creditService.balanceOf(principal.id()))));
    }

    /** 로그인 사용자가 만든 브랜드 키트를 최신순으로 조회한다. */
    @GetMapping("/brand-kits")
    public ResponseEntity<ApiSuccessResponse<List<BrandKitResponse>>> brandKits(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(brandKitService.listForMember(principal.id())));
    }

    /** 설문조사 응답 여부 확인. 이미 응답했으면 화면에서 버튼을 감춘다. */
    @GetMapping("/survey")
    public ResponseEntity<ApiSuccessResponse<SurveyResponse>> surveyStatus(
            @AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(surveyService.status(principal.id())));
    }

    /** 설문조사 제출. 성공하면 크레딧 1개가 지급된다. 회원당 1회만 가능하다. */
    @PostMapping("/survey")
    public ResponseEntity<ApiSuccessResponse<SurveyResponse>> submitSurvey(
            @AuthenticationPrincipal MemberPrincipal principal,
            @Valid @RequestBody(required = false) SurveySubmitRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(surveyService.submit(principal.id(), request)));
    }

    private LogoDownload.ProjectType parseType(String type) {
        try {
            return LogoDownload.ProjectType.valueOf(type.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "type은 CI 또는 BI여야 합니다.");
        }
    }
}
