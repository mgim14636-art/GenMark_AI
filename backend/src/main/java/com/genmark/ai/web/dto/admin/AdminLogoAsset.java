package com.genmark.ai.web.dto.admin;

/** A real logo candidate shown in the administrator generation lists. */
public record AdminLogoAsset(
        String id,
        String projectId,
        String imageUrl,
        String name,
        String date
) {}
