package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.dto.onboarding.OnboardingResponse;
import com.genmark.ai.web.dto.onboarding.OnboardingUpsertRequest;
import com.genmark.ai.web.dto.project.ProjectUpsertRequest;
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

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {
    @Mock MemberOnboardingRepository onboardingRepository;
    @Mock MemberRepository memberRepository;
    @Mock ProjectService projectService;
    OnboardingService service;

    @BeforeEach void setUp() {
        service = new OnboardingService(onboardingRepository, memberRepository, projectService);
    }

    @Test
    void skippedCompletesWithoutProject() {
        Member member = Member.builder().id(1L).email("a@test.local").name("A").build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(onboardingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OnboardingResponse response = service.complete(1L, new OnboardingUpsertRequest(
                List.of("PERSONAL"), "20s", MemberOnboarding.DetailsDecision.SKIPPED, null));

        assertThat(response.completed()).isTrue();
        assertThat(response.usage()).containsExactly("PERSONAL");
        verify(projectService, never()).createInitial(any(), any());
    }

    @Test
    void multipleUsageValuesFillOptionalColumns() {
        Member member = Member.builder().id(1L).email("a@test.local").name("A").build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(onboardingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OnboardingResponse response = service.complete(1L, new OnboardingUpsertRequest(
                List.of("online", "social", "offline"), "20s", MemberOnboarding.DetailsDecision.SKIPPED, null));

        assertThat(response.usage()).containsExactly("online", "social", "offline");
    }

    @Test
    void rejectsMoreThanThreeUsageValues() {
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        OnboardingUpsertRequest request = new OnboardingUpsertRequest(
                List.of("online", "social", "offline", "extra"), "20s", MemberOnboarding.DetailsDecision.SKIPPED, null);

        assertThatThrownBy(() -> service.complete(1L, request)).isInstanceOf(ApiException.class);
    }

    @Test
    void submittedRequiresInitialProject() {
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        OnboardingUpsertRequest request = new OnboardingUpsertRequest(
                List.of("BUSINESS"), "all", MemberOnboarding.DetailsDecision.SUBMITTED, null);
        assertThatThrownBy(() -> service.complete(1L, request)).isInstanceOf(ApiException.class);
    }

    @Test
    void submittedStillCreatesProjectEvenThoughLinkIsNoLongerStored() {
        Member member = Member.builder().id(1L).email("a@test.local").name("A").build();
        ProjectUpsertRequest projectRequest = new ProjectUpsertRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(onboardingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.complete(1L, new OnboardingUpsertRequest(
                List.of("online"), "all", MemberOnboarding.DetailsDecision.SUBMITTED, projectRequest));

        verify(projectService).createInitial(member, projectRequest);
    }

    @Test
    void completedRequestIsIdempotent() {
        MemberOnboarding existing = MemberOnboarding.builder().memberId(1L).usage1("online").audience("all")
                .detailsDecision(MemberOnboarding.DetailsDecision.SKIPPED).completedAt(LocalDateTime.now()).build();
        when(onboardingRepository.findById(1L)).thenReturn(Optional.of(existing));

        service.complete(1L, new OnboardingUpsertRequest(
                List.of("OTHER"), "changed", MemberOnboarding.DetailsDecision.SKIPPED, null));

        verify(onboardingRepository, never()).save(any());
        verify(memberRepository, never()).findById(any());
    }
}
