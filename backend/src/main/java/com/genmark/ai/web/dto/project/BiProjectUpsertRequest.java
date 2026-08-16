package com.genmark.ai.web.dto.project;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record BiProjectUpsertRequest(
        @Size(max = 100) String industry,
        @Size(max = 150) String brandName,
        @Size(max = 50) String valueCategory1,
        @Size(max = 50) String valueCategory2,
        @Size(max = 50) String valueCategory3,
        @Size(max = 300) String brandDescription,
        @Size(max = 20) String targetAge,
        @Size(max = 100) String tone,
        @Pattern(regexp = "TONE|MANUAL") String colorMode,
        @Size(max = 7) String color1,
        @Size(max = 7) String color2,
        @Size(max = 7) String color3,
        @Size(max = 7) String color4,
        @Size(max = 50) String logoStyle,
        @Size(max = 100) String logoShape,
        @Size(max = 300) String additionalRequirements
) {}
