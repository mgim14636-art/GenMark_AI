package com.genmark.ai.web.dto.project;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record BiProjectUpsertRequest(
        @Size(max = 100)
        @Pattern(regexp = "COSMETICS|FASHION|FOOD|HEALTH_WELLNESS|TECH|EDUCATION|PET|OTHER") String industry,
        @Size(max = 150) String brandName,
        @Size(max = 50) String valueCategory1,
        @Size(max = 50) String valueCategory2,
        @Size(max = 50) String valueCategory3,
        @Size(max = 300) String brandDescription,
        @Size(max = 20) @Pattern(regexp = "10~20|30~40|50~60|전 연령층") String targetAge,
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
    public BiProjectUpsertRequest(String industry, String brandName, String valueCategory1, String valueCategory2,
                                  String valueCategory3, String brandDescription, String targetAge, String tone,
                                  String colorMode, String color1, String color2, String color3, String color4,
                                  String logoStyle, String logoShape, String additionalRequirements) {
        this(industry, brandName, valueCategory1, valueCategory2, valueCategory3, brandDescription, targetAge, tone,
                colorMode, color1, color2, color3, color4, logoStyle, logoShape, additionalRequirements, false);
    }
}
