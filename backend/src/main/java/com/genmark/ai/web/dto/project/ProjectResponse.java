package com.genmark.ai.web.dto.project;

import com.genmark.ai.entity.Project;

import java.time.LocalDateTime;
import java.util.List;

public record ProjectResponse(
        String id,
        Project.Status status,
        String brandType,
        String industry,
        String brandName,
        String companyName,
        String companyMotto,
        List<String> brandValues,
        String brandValuesText,
        String targetAge,
        String tone,
        String colorMode,
        List<String> colors,
        String logoStyle,
        boolean includeBrandName,
        String additionalRequirements,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
