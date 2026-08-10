package com.genmark.ai.web.dto.onboarding;

import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.web.dto.project.BiProjectUpsertRequest;
import com.genmark.ai.web.dto.project.CiProjectUpsertRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record OnboardingUpsertRequest(
        @NotEmpty List<@NotBlank @Size(max = 100) String> usage,
        @NotBlank @Size(max = 100) String audience,
        @NotNull MemberOnboarding.DetailsDecision detailsDecision,
        @Valid CiProjectUpsertRequest initialCiProject,
        @Valid BiProjectUpsertRequest initialBiProject
) {}
