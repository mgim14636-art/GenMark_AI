package com.genmark.ai.web.dto.trademark;

public record TrademarkMatchResponse(
        int rank,
        String applicationNumber,
        String name,
        String category,
        int similarity,
        String imagePath
) {}
