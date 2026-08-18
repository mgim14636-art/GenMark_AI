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
}
