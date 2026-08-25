package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.dto.admin.AdminMemberRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStatsServiceTest {

    @Mock MemberRepository memberRepository;
    @Mock LogoGenerationRepository generationRepository;
    @Mock LogoDownloadRepository downloadRepository;
    @Mock MemberOnboardingRepository onboardingRepository;

    @InjectMocks AdminStatsService service;

    @Test
    void memberWithoutOnboardingIsMarkedIncomplete() {
        Member member = Member.builder().id(1L).email("a@a.com").name("미작성 회원").createdAt(LocalDateTime.now()).build();
        when(memberRepository.findAll()).thenReturn(List.of(member));
        when(onboardingRepository.findById(1L)).thenReturn(Optional.empty());

        List<AdminMemberRow> rows = service.members();

        assertThat(rows).hasSize(1);
        AdminMemberRow row = rows.get(0);
        assertThat(row.onboardingCompleted()).isFalse();
        assertThat(row.onboardingUsage()).isEmpty();
        assertThat(row.onboardingAudience()).isNull();
        assertThat(row.onboardingCompletedAt()).isNull();
    }

    @Test
    void memberWithOnboardingReturnsSelectedUsageAndAudience() {
        Member member = Member.builder().id(2L).email("b@b.com").name("작성 완료 회원").createdAt(LocalDateTime.now()).build();
        LocalDateTime completedAt = LocalDateTime.of(2026, 8, 20, 10, 0);
        MemberOnboarding onboarding = MemberOnboarding.builder()
                .memberId(2L).usage1("online").usage2("social").usage3(null)
                .audience("owner").completedAt(completedAt).build();
        when(memberRepository.findAll()).thenReturn(List.of(member));
        when(onboardingRepository.findById(2L)).thenReturn(Optional.of(onboarding));

        List<AdminMemberRow> rows = service.members();

        assertThat(rows).hasSize(1);
        AdminMemberRow row = rows.get(0);
        assertThat(row.onboardingCompleted()).isTrue();
        assertThat(row.onboardingUsage()).containsExactly("online", "social");
        assertThat(row.onboardingAudience()).isEqualTo("owner");
        assertThat(row.onboardingCompletedAt()).isEqualTo(completedAt);
    }
}
