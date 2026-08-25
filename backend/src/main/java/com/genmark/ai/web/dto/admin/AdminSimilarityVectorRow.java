package com.genmark.ai.web.dto.admin;

/** 관리자 "유사도 관리 및 테스트" 화면 목록에 나오는, 벡터화된 자체 생성 로고 한 건. */
public record AdminSimilarityVectorRow(
        Long id,
        String candidateId,
        String projectId,
        String projectType,
        String name,
        String imageUrl,
        String vectorizedAt
) {}
