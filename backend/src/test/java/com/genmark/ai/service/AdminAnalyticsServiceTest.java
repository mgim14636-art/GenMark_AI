package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.Admin;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.CreditHistory;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.entity.MemberSurvey;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.repository.AdminRepository;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.CreditHistoryRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.web.dto.admin.AdminAnalyticsResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAnalyticsServiceTest {

    @Mock AdminRepository adminRepository;
    @Mock BiProjectRepository biProjectRepository;
    @Mock CiProjectRepository ciProjectRepository;
    @Mock CreditHistoryRepository creditHistoryRepository;
    @Mock LogoCandidateRepository candidateRepository;
    @Mock LogoDownloadRepository downloadRepository;
    @Mock LogoGenerationRepository generationRepository;
    @Mock MemberOnboardingRepository onboardingRepository;
    @Mock MemberRepository memberRepository;
    @Mock MemberSurveyRepository surveyRepository;
    @Mock TrademarkAnalysisRepository trademarkAnalysisRepository;
    @Mock LogoFileStorage fileStorage;
    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks AdminAnalyticsService service;

    @Test
    void analyticsUsesProviderAndReturnsEmptyBucketsWithoutMockValues() {
        Member member = Member.builder()
                .id(1L)
                .email("google@example.com")
                .name("구글 사용자")
                .provider("google")
                .creditBalance(2)
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();
        when(memberRepository.findAll()).thenReturn(List.of(member));
        when(biProjectRepository.findAll()).thenReturn(List.of());
        when(ciProjectRepository.findAll()).thenReturn(List.of());
        when(creditHistoryRepository.findAll()).thenReturn(List.of());
        when(downloadRepository.findAll()).thenReturn(List.of());
        when(generationRepository.findAll()).thenReturn(List.of());
        when(onboardingRepository.findAll()).thenReturn(List.of());
        when(surveyRepository.findAll()).thenReturn(List.of());
        when(trademarkAnalysisRepository.findAll()).thenReturn(List.of());

        AdminAnalyticsResponse response = service.analytics("weekly", null, null);

        assertThat(response.overview().totalMembers()).isEqualTo(1);
        assertThat(response.overview().totalGenerations()).isZero();
        assertThat(response.overview().totalDownloads()).isZero();
        assertThat(response.signup().providerCounts())
                .extracting("label", "value")
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Google 로그인", 1L));
        assertThat(response.signup().trend()).hasSize(7);
        assertThat(response.survey().improvements()).allMatch(item -> item.value() == 0);
    }

    private void stubAllEmpty() {
        when(memberRepository.findAll()).thenReturn(List.of());
        when(biProjectRepository.findAll()).thenReturn(List.of());
        when(ciProjectRepository.findAll()).thenReturn(List.of());
        when(creditHistoryRepository.findAll()).thenReturn(List.of());
        when(downloadRepository.findAll()).thenReturn(List.of());
        when(generationRepository.findAll()).thenReturn(List.of());
        when(onboardingRepository.findAll()).thenReturn(List.of());
        when(surveyRepository.findAll()).thenReturn(List.of());
        when(trademarkAnalysisRepository.findAll()).thenReturn(List.of());
    }

    @Test
    void customPeriodWithinOneMonthShowsOneBucketPerDay() {
        stubAllEmpty();

        // 8/1 ~ 8/10, 10일짜리 기간 → 하루씩 10칸
        AdminAnalyticsResponse response = service.analytics("custom", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 10));

        assertThat(response.signup().trend()).extracting("label")
                .containsExactly("8/1", "8/2", "8/3", "8/4", "8/5", "8/6", "8/7", "8/8", "8/9", "8/10");
    }

    @Test
    void customPeriodOverOneMonthShowsOneBucketPerMonth() {
        stubAllEmpty();

        // 8/1 ~ 다음해 1/1, 5개월 넘는 기간 → 달마다
        AdminAnalyticsResponse response = service.analytics("custom", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 12, 31));

        assertThat(response.signup().trend()).extracting("label")
                .containsExactly("8월", "9월", "10월", "11월", "12월");
    }

    @Test
    void customPeriodOverOneYearShowsOneBucketPerYear() {
        stubAllEmpty();

        // 2025년 1월 ~ 2027년 12월, 2년 넘는 기간 → 해마다
        AdminAnalyticsResponse response = service.analytics("custom", LocalDate.of(2025, 1, 1), LocalDate.of(2027, 12, 31));

        assertThat(response.signup().trend()).extracting("label")
                .containsExactly("2025년", "2026년", "2027년");
    }

    @Test
    void onboardingAudienceReturnsAllFourCategoriesInFixedOrderIncludingZeros() {
        stubAllEmpty();
        LocalDateTime now = LocalDateTime.now();
        MemberOnboarding company1 = MemberOnboarding.builder().memberId(1L).usage1("online").audience("company").completedAt(now).build();
        MemberOnboarding company2 = MemberOnboarding.builder().memberId(2L).usage1("online").audience("company").completedAt(now).build();
        MemberOnboarding owner = MemberOnboarding.builder().memberId(3L).usage1("online").audience("owner").completedAt(now).build();
        // 기간 밖(1년도 더 전) 응답은 집계에서 빠져야 한다.
        MemberOnboarding outOfRange = MemberOnboarding.builder().memberId(4L).usage1("online").audience("hobby").completedAt(now.minusYears(1)).build();
        when(onboardingRepository.findAll()).thenReturn(List.of(company1, company2, owner, outOfRange));

        AdminAnalyticsResponse response = service.analytics("weekly", null, null);

        assertThat(response.signup().onboardingAudience())
                .extracting("label", "value")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("회사 / 팀", 2L),
                        org.assertj.core.groups.Tuple.tuple("자영업", 1L),
                        org.assertj.core.groups.Tuple.tuple("취미 / 창작", 0L),
                        org.assertj.core.groups.Tuple.tuple("부업 & 투잡", 0L));
    }
}
