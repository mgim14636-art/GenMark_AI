package com.genmark.ai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogoGenerateResponse {
    private Long logoId;
    private Long projectId;
    private String prompt;
    private String imageUrl;
    private String status;
}
