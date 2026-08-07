package com.genmark.ai.web.dto.logo;

import com.genmark.ai.entity.LogoGeneration;

import java.time.LocalDateTime;

public record LogoGenerationResponse(
        String id,
        String projectId,
        LogoGeneration.Status status,
        int candidateCount,
        String modelName,
        String errorCode,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime createdAt
) {}
