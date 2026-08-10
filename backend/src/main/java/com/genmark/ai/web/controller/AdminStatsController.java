package com.genmark.ai.web.controller;

import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.service.AdminStatsService;
import com.genmark.ai.service.LogoDownloadService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.admin.AdminDashboardResponse;
import com.genmark.ai.web.dto.admin.AdminDownloadRow;
import com.genmark.ai.web.dto.admin.AdminMemberRow;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;

/**
 * 관리자 화면 3종 (F16-1 대시보드 / F16-2 회원관리 / F16-3 통계).
 *
 * <p>이 경로는 SecurityConfig에서 {@code hasRole("ADMIN")}으로 막혀 있어 관리자 토큰만 통과한다.
 * 일반 회원 토큰은 authorities가 비어 있어 403이 된다.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminStatsController {

    private final AdminStatsService adminStatsService;
    private final LogoDownloadService logoDownloadService;

    /** F16-1 대시보드: 가입자 현황 / 로고 생성 건수 / 다운로드 건수. */
    @GetMapping("/dashboard")
    public ResponseEntity<ApiSuccessResponse<AdminDashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiSuccessResponse.of(adminStatsService.dashboard()));
    }

    /** F16-2 회원관리: 회원 목록과 회원별 집계. */
    @GetMapping("/members")
    public ResponseEntity<ApiSuccessResponse<List<AdminMemberRow>>> members() {
        return ResponseEntity.ok(ApiSuccessResponse.of(adminStatsService.members()));
    }

    /**
     * F16-3 통계: 특정 회원이 다운로드한 CI 또는 BI 로고 목록.
     *
     * @param type CI 또는 BI. 목록이 둘로 나뉘어 있으므로 필수다
     */
    @GetMapping("/members/{memberId}/downloads")
    public ResponseEntity<ApiSuccessResponse<List<AdminDownloadRow>>> downloads(
            @PathVariable Long memberId, @RequestParam String type) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                adminStatsService.downloadsOf(memberId, parseType(type))));
    }

    /** 통계 목록에서 항목을 클릭했을 때 보여줄 실제 이미지. */
    @GetMapping("/downloads/{downloadId}/image")
    public ResponseEntity<byte[]> downloadImage(@PathVariable Long downloadId) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(logoDownloadService.readImageAsAdmin(downloadId));
    }

    private LogoDownload.ProjectType parseType(String type) {
        try {
            return LogoDownload.ProjectType.valueOf(type.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "type은 CI 또는 BI여야 합니다.");
        }
    }
}
