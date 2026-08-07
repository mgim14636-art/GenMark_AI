package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.OnboardingService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.onboarding.OnboardingResponse;
import com.genmark.ai.web.dto.onboarding.OnboardingUpsertRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/onboarding")
@RequiredArgsConstructor
public class OnboardingController {
    private final OnboardingService onboardingService;

    @GetMapping
    public ResponseEntity<ApiSuccessResponse<OnboardingResponse>> get(@AuthenticationPrincipal MemberPrincipal principal) {
        return ResponseEntity.ok(ApiSuccessResponse.of(onboardingService.get(principal.id())));
    }

    @PutMapping
    public ResponseEntity<ApiSuccessResponse<OnboardingResponse>> complete(
            @AuthenticationPrincipal MemberPrincipal principal,
            @Valid @RequestBody OnboardingUpsertRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(onboardingService.complete(principal.id(), request)));
    }
}
