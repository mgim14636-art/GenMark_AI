package com.genmark.ai.web.dto.logo;

import java.time.LocalDateTime;

/**
 * 생성된 로고 후보 한 장.
 *
 * @param selected 이 프로젝트에서 최종 채택한 로고인지. 프로젝트당 한 개만 true다
 * @param pinnedAt 찜한 시각. null이면 찜하지 않은 상태다.
 *                 찜(보류) / selected(채택) / 다운로드(내려받음)는 서로 다른 상태다
 */
public record LogoCandidateResponse(
        String id,
        int order,
        String storageKey,
        String mimeType,
        Integer width,
        Integer height,
        boolean selected,
        LocalDateTime pinnedAt,
        LocalDateTime createdAt
) {}
