package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.dto.onboarding.OnboardingResponse;
import com.genmark.ai.web.dto.onboarding.OnboardingUpsertRequest;
import com.genmark.ai.web.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 온보딩은 "회원당 1회, 용도 최대 3개"가 전부다.
 *
 * <p>예전에는 온보딩에서 초기 CI/BI 프로젝트까지 함께 만들 수 있었고(detailsDecision),
 * 그 분기를 검증하는 테스트가 있었다. 지금은 프로젝트를 온보딩 이후 별도 화면에서 만들도록
 * 흐름이 바뀌어 해당 기능과 테스트를 제거했다.
 */
@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {
    @Mock MemberOnboardingRepository onboardingRepository;
    @Mock MemberRepository memberRepository;
    OnboardingService service;

    @BeforeEach void setUp() {
        service = new OnboardingService(onboardingRepository, memberRepository);
    }

    @Test
    void completesWithUsageAndAudience() {
        Member member = Member.builder().id(1L).email("a@test.local").name("A").build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(onboardingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OnboardingResponse response = service.complete(1L,
                new OnboardingUpsertRequest(List.of("PERSONAL"), "20s"));

        assertThat(response.completed()).isTrue();
        assertThat(response.usage()).containsExactly("PERSONAL");
        assertThat(response.audience()).isEqualTo("20s");
    }

    @Test
    void multipleUsageValuesFillOptionalColumns() {
        Member member = Member.builder().id(1L).email("a@test.local").name("A").build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(onboardingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OnboardingResponse response = service.complete(1L,
                new OnboardingUpsertRequest(List.of("online", "social", "offline"), "20s"));

        assertThat(response.usage()).containsExactly("online", "social", "offline");
    }

    @Test
    void rejectsMoreThanThreeUsageValues() {
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        OnboardingUpsertRequest request =
                new OnboardingUpsertRequest(List.of("online", "social", "offline", "extra"), "20s");

        assertThatThrownBy(() -> service.complete(1L, request)).isInstanceOf(ApiException.class);
    }

    @Test
    void completedRequestIsIdempotent() {
        MemberOnboarding existing = MemberOnboarding.builder().memberId(1L).usage1("online").audience("all")
                .completedAt(LocalDateTime.now()).build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.of(existing));

        service.complete(1L, new OnboardingUpsertRequest(List.of("OTHER"), "changed"));

        verify(onboardingRepository, never()).save(any());
        verify(memberRepository, never()).findById(any());
    }
}
