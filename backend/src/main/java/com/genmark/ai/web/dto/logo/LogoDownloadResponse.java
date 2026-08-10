package com.genmark.ai.web.dto.logo;

import java.time.LocalDateTime;

/**
 * 다운로드 기록 응답.
 *
 * @param firstTime 이번 요청으로 처음 기록됐는지 여부.
 *                  false면 이전에 이미 받은 로고라 다운로드 횟수가 늘지 않았다는 뜻이다.
 *                  화면에서 "이미 받은 로고예요" 안내를 띄우고 싶을 때 쓴다
 */
public record LogoDownloadResponse(
        Long downloadId,
        String candidateId,
        String projectType,
        String imageUrl,
        boolean firstTime,
        LocalDateTime downloadedAt
) {}
