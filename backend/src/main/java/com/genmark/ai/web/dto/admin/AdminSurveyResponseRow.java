package com.genmark.ai.web.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

/** Survey feedback stored in member_surveys. */
public record AdminSurveyResponseRow(
        Long memberId,
        String memberEmail,
        String memberName,
        Integer rating,
        List<String> improvements,
        String comment,
        LocalDateTime completedAt
) {}
