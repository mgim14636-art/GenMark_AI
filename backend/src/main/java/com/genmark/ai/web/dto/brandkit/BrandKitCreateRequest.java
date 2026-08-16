package com.genmark.ai.web.dto.brandkit;

import jakarta.validation.Valid;

public record BrandKitCreateRequest(@Valid BusinessCardInfoRequest cardInfo) {}
