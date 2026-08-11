package com.genmark.ai.web.dto.logo;

import java.time.LocalDateTime;

/**
 * 찜한 로고 한 장.
 *
 * @param expiresAt 이 시각이 지나면 찜이 자동 해제된다.
 *                  화면에 "n일 뒤 사라져요" 안내를 띄우는 데 쓴다
 */
public record PinnedCandidateResponse(
        String candidateId,
        String storageKey,
        LocalDateTime pinnedAt,
        LocalDateTime expiresAt
) {}
