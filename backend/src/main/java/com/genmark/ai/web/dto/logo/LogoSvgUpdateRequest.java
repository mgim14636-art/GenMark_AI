package com.genmark.ai.web.dto.logo;

import jakarta.validation.constraints.NotBlank;

public record LogoSvgUpdateRequest(@NotBlank String svg) {
}
