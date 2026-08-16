package com.genmark.ai.web.dto.project;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record CiProjectUpsertRequest(
        @Size(max = 100)
        @Pattern(regexp = "COSMETICS|FASHION|FOOD|HEALTH_WELLNESS|TECH|EDUCATION|PET|OTHER") String industry,
        @Size(max = 150) String companyName,
        @Size(max = 300) String coreValues,
        @Size(max = 100) String tone,
        @Pattern(regexp = "TONE|MANUAL") String colorMode,
        @Size(max = 7) @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color1,
        @Size(max = 7) @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color2,
        @Size(max = 7) @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color3,
        @Size(max = 7) @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color4,
        @Size(max = 50) @Pattern(regexp = "symbol|wordmark|combination|lettermark") String logoStyle,
        @Size(max = 100) String logoShape,
        @Size(max = 300) String additionalRequirements,
        Boolean paletteReplace
) {
    /** Source compatibility for callers using the original sparse-patch contract. */
    public CiProjectUpsertRequest(String industry, String companyName, String coreValues, String tone,
                                  String colorMode, String color1, String color2, String color3, String color4,
                                  String logoStyle, String logoShape, String additionalRequirements) {
        this(industry, companyName, coreValues, tone, colorMode, color1, color2, color3, color4,
                logoStyle, logoShape, additionalRequirements, false);
    }
}
