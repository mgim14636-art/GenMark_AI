package com.genmark.ai.web.dto.brandkit;

import jakarta.validation.Valid;

public record BrandKitCreateRequest(
        String kitType,
        @Valid BusinessCardInfoRequest cardInfo
) {
    public BrandKitCreateRequest(BusinessCardInfoRequest cardInfo) {
        this(null, cardInfo);
    }
}
