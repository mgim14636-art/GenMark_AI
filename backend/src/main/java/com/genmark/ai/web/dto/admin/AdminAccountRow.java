package com.genmark.ai.web.dto.admin;

import java.time.LocalDateTime;

/** One administrator account row. */
public record AdminAccountRow(
        Long id,
        String loginId,
        String name,
        LocalDateTime createdAt,
        LocalDateTime lastAccessAt
) {}
