package com.genmark.ai.web.dto.project;

import com.genmark.ai.entity.ProjectStatus;

import java.time.LocalDateTime;
import java.util.List;

public record CiProjectResponse(
        String id,
        ProjectStatus status,
        int currentStep,
        String industry,
        String companyName,
        String coreValues,
        String tone,
        List<String> colors,
        String logoStyle,
        String additionalRequirements,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
