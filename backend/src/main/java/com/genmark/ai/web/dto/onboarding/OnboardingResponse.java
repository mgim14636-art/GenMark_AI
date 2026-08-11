package com.genmark.ai.web.dto.onboarding;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 온보딩 상태.
 *
 * @param completed 온보딩을 마쳤는지. false면 최초 로그인 사용자라 온보딩 화면을 보여준다
 */
public record OnboardingResponse(
        boolean completed,
        List<String> usage,
        String audience,
        LocalDateTime completedAt
) {
    public static OnboardingResponse incomplete() {
        return new OnboardingResponse(false, List.of(), null, null);
    }
}
