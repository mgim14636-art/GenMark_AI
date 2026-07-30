package com.genmark.ai.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SimilarityRequest {
    @NotNull(message = "Logo ID is required")
    private Long logoId;
}
