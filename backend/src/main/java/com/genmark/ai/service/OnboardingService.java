package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.entity.Project;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.dto.onboarding.OnboardingResponse;
import com.genmark.ai.web.dto.onboarding.OnboardingUpsertRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OnboardingService {
    private final MemberOnboardingRepository onboardingRepository;
    private final MemberRepository memberRepository;
    private final ProjectService projectService;

    public boolean isCompleted(Long memberId) {
        return onboardingRepository.existsByMemberIdAndCompletedAtIsNotNull(memberId);
    }

    public OnboardingResponse get(Long memberId) {
        return onboardingRepository.findById(memberId).map(this::toResponse)
                .orElseGet(OnboardingResponse::incomplete);
    }

    @Transactional
    public OnboardingResponse complete(Long memberId, OnboardingUpsertRequest request) {
        MemberOnboarding existing = onboardingRepository.findById(memberId).orElse(null);
        if (existing != null && existing.getCompletedAt() != null) return toResponse(existing);

        if (request.detailsDecision() == MemberOnboarding.DetailsDecision.SUBMITTED
                && request.initialProject() == null) {
            throw new ApiException(ErrorCode.ONBOARDING_DETAILS_REQUIRED);
        }
        if (request.detailsDecision() == MemberOnboarding.DetailsDecision.SKIPPED
                && request.initialProject() != null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "상세정보를 건너뛸 때는 initialProject를 보내지 마세요.");
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));
        Project initialProject = request.detailsDecision() == MemberOnboarding.DetailsDecision.SUBMITTED
                ? projectService.createInitial(member, request.initialProject()) : null;

        MemberOnboarding onboarding = MemberOnboarding.builder()
                .member(member)
                .usageJson(projectService.writeList(request.usage()))
                .audience(request.audience().trim())
                .detailsDecision(request.detailsDecision())
                .initialProject(initialProject)
                .completedAt(LocalDateTime.now())
                .schemaVersion(1)
                .build();
        return toResponse(onboardingRepository.save(onboarding));
    }

    private OnboardingResponse toResponse(MemberOnboarding onboarding) {
        String projectId = onboarding.getInitialProject() == null ? null : onboarding.getInitialProject().getPublicId();
        return new OnboardingResponse(true, projectService.readList(onboarding.getUsageJson()), onboarding.getAudience(),
                onboarding.getDetailsDecision(), projectId, onboarding.getCompletedAt(), onboarding.getSchemaVersion());
    }
}
