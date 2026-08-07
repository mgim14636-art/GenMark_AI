package com.genmark.ai.web.dto.onboarding;

import com.genmark.ai.entity.MemberOnboarding;

import java.time.LocalDateTime;
import java.util.List;

public record OnboardingResponse(
        boolean completed,
        List<String> usage,
        String audience,
        MemberOnboarding.DetailsDecision detailsDecision,
        String initialProjectId,
        LocalDateTime completedAt,
        int schemaVersion
) {
    public static OnboardingResponse incomplete() {
        return new OnboardingResponse(false, List.of(), null, null, null, null, 1);
    }
}
