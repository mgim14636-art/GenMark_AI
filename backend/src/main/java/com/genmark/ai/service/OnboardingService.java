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

/**
 * 온보딩 (F4). 처음 로그인한 사용자에게만 한 번 받는다.
 *
 * <p>member_onboardings는 회원당 1행(member_id가 기본키)이라 "최초 1회만"이라는 규칙을
 * DB가 직접 보장한다.
 *
 * <p>예전에는 여기서 초기 CI/BI 프로젝트까지 함께 만들었지만, 지금은 온보딩이 끝난 뒤
 * 업종 선택 → CI/BI 선택 → 입력 순서로 별도 진행하므로 그 로직을 제거했다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OnboardingService {
    private final MemberOnboardingRepository onboardingRepository;
    private final MemberRepository memberRepository;

    public boolean isCompleted(Long memberId) {
        return onboardingRepository.existsByMemberIdAndCompletedAtIsNotNull(memberId);
    }

    public OnboardingResponse get(Long memberId) {
        return onboardingRepository.findById(memberId).map(this::toResponse)
                .orElseGet(OnboardingResponse::incomplete);
    }

    /**
     * 온보딩 완료 처리. 이미 마친 회원이 다시 보내면 기존 내용을 그대로 돌려준다(멱등).
     */
    @Transactional
    public OnboardingResponse complete(Long memberId, OnboardingUpsertRequest request) {
        MemberOnboarding existing = onboardingRepository.findById(memberId).orElse(null);
        if (existing != null && existing.getCompletedAt() != null) return toResponse(existing);

        if (request.usage().size() > 3) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "usage는 최대 3개까지 선택할 수 있습니다.");
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));

        List<String> usage = request.usage();
        MemberOnboarding onboarding = MemberOnboarding.builder()
                .member(member)
                .usage1(usage.get(0))
                .usage2(usage.size() > 1 ? usage.get(1) : null)
                .usage3(usage.size() > 2 ? usage.get(2) : null)
                .audience(request.audience().trim())
                .completedAt(LocalDateTime.now())
                .build();
        return toResponse(onboardingRepository.save(onboarding));
    }

    private OnboardingResponse toResponse(MemberOnboarding onboarding) {
        return new OnboardingResponse(true, readUsage(onboarding), onboarding.getAudience(),
                onboarding.getCompletedAt());
    }

    private List<String> readUsage(MemberOnboarding onboarding) {
        return Stream.of(onboarding.getUsage1(), onboarding.getUsage2(), onboarding.getUsage3())
                .filter(Objects::nonNull)
                .toList();
    }
}
