package com.genmark.ai.web.dto.project;

import com.genmark.ai.entity.ProjectStatus;

import java.time.LocalDateTime;
import java.util.List;

public record BiProjectResponse(
        String id,
        ProjectStatus status,
        int currentStep,
        String industry,
        String brandName,
        List<String> valueCategories,
        String brandDescription,
        String targetAge,
        String tone,
        String colorMode,
        List<String> colors,
        String logoStyle,
        String logoShape,
        String additionalRequirements,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
