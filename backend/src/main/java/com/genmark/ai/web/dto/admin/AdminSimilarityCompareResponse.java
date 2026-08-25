package com.genmark.ai.web.dto.admin;

/** 관리자가 벡터 로고와 비교 이미지를 1:1로 비교한 결과. 기록은 저장하지 않는다. */
public record AdminSimilarityCompareResponse(
        int similarity,
        String riskLevel,
        String disclaimer,
        String note
) {}
