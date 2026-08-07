package com.genmark.ai.web.dto.logo;

import java.time.LocalDateTime;

public record LogoCandidateResponse(
        String id,
        int order,
        String storageKey,
        String mimeType,
        Integer width,
        Integer height,
        boolean selected,
        boolean saved,
        LocalDateTime createdAt
) {}
