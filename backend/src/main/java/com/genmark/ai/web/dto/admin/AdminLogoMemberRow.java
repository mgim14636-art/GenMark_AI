package com.genmark.ai.web.dto.admin;

import java.util.List;

/** Per-member CI/BI generated and downloaded logo records. */
public record AdminLogoMemberRow(
        String memberId,
        String memberName,
        List<AdminLogoAsset> generatedLogos,
        List<AdminLogoAsset> downloadedLogos
) {}
