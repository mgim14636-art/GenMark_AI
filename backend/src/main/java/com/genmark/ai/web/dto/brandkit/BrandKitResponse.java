package com.genmark.ai.web.dto.brandkit;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 브랜드킷 생성 작업 상태와 결과.
 *
 * @param kitType     BUSINESS_CARD(명함, CI용) | THUMBNAIL(제품 썸네일, BI용)
 * @param status      QUEUED | RUNNING | SUCCEEDED | FAILED.
 *                    비동기라 요청 직후에는 QUEUED로 돌아오며, 화면은 이후 폴링해서 상태를 확인해야 한다
 * @param storageKey  완성된 이미지 경로. SUCCEEDED 전에는 null
 * @param errorCode   실패했을 때만 채워진다. 화면에 실패 이유를 보여주는 근거
 */
public record BrandKitResponse(
        String id,
        String candidateId,
        String projectId,
        String kitType,
        String status,
        String storageKey,
        List<String> storageKeys,
        boolean preliminary,
        List<String> warnings,
        String errorCode,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime createdAt
) {}
