package com.genmark.ai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LogoGenerateRequest {
    @NotNull(message = "Project ID is required")
    private Long projectId;

    @NotBlank(message = "Prompt must not be blank")
    private String prompt;
}
