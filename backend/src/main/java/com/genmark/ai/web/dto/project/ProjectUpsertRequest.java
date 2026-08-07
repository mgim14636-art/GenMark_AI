package com.genmark.ai.web.dto.project;

import jakarta.validation.constraints.Size;

import java.util.List;

public record ProjectUpsertRequest(
        @Size(max = 50) String brandType,
        @Size(max = 100) String industry,
        @Size(max = 150) String brandName,
        @Size(max = 150) String companyName,
        @Size(max = 255) String companyMotto,
        List<String> brandValues,
        String brandValuesText,
        @Size(max = 50) String targetAge,
        @Size(max = 100) String tone,
        @Size(max = 30) String colorMode,
        List<String> colors,
        @Size(max = 50) String logoStyle,
        Boolean includeBrandName,
        String additionalRequirements
) {}
