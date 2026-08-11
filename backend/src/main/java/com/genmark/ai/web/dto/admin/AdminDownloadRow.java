package com.genmark.ai.web.dto.admin;

import java.time.LocalDateTime;

/**
 * 관리자 통계 화면에서 보여줄 다운로드 기록 한 줄 (F16-3).
 *
 * <p>{@code imageUrl}은 보관된 이미지를 내려받는 관리자용 주소다. 클릭하면 실제 이미지가 보인다.
 */
public record AdminDownloadRow(
        Long downloadId,
        String candidateId,
        String projectType,
        String imageUrl,
        LocalDateTime downloadedAt
) {}
