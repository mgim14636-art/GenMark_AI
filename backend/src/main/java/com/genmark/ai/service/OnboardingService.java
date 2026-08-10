package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
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
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OnboardingService {
    private final MemberOnboardingRepository onboardingRepository;
    private final MemberRepository memberRepository;
    private final CiProjectService ciProjectService;
    private final BiProjectService biProjectService;

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

        boolean hasCi = request.initialCiProject() != null;
        boolean hasBi = request.initialBiProject() != null;
        if (request.detailsDecision() == MemberOnboarding.DetailsDecision.SUBMITTED && !hasCi && !hasBi) {
            throw new ApiException(ErrorCode.ONBOARDING_DETAILS_REQUIRED);
        }
        if (request.detailsDecision() == MemberOnboarding.DetailsDecision.SUBMITTED && hasCi && hasBi) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "initialCiProject와 initialBiProject 중 하나만 보내세요.");
        }
        if (request.detailsDecision() == MemberOnboarding.DetailsDecision.SKIPPED && (hasCi || hasBi)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "상세정보를 건너뛸 때는 initialCiProject/initialBiProject를 보내지 마세요.");
        }
        if (request.usage().size() > 3) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "usage는 최대 3개까지 선택할 수 있습니다.");
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));
        if (hasCi) {
            ciProjectService.createInitial(member, request.initialCiProject());
        } else if (hasBi) {
            biProjectService.createInitial(member, request.initialBiProject());
        }

        List<String> usage = request.usage();
        MemberOnboarding onboarding = MemberOnboarding.builder()
                .member(member)
                .usage1(usage.get(0))
                .usage2(usage.size() > 1 ? usage.get(1) : null)
                .usage3(usage.size() > 2 ? usage.get(2) : null)
                .audience(request.audience().trim())
                .detailsDecision(request.detailsDecision())
                .completedAt(LocalDateTime.now())
                .schemaVersion(1)
                .build();
        return toResponse(onboardingRepository.save(onboarding));
    }

    private OnboardingResponse toResponse(MemberOnboarding onboarding) {
        return new OnboardingResponse(true, readUsage(onboarding), onboarding.getAudience(),
                onboarding.getDetailsDecision(), onboarding.getCompletedAt(), onboarding.getSchemaVersion());
    }

    private List<String> readUsage(MemberOnboarding onboarding) {
        return Stream.of(onboarding.getUsage1(), onboarding.getUsage2(), onboarding.getUsage3())
                .filter(Objects::nonNull)
                .toList();
    }
}
