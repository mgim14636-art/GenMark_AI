package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.oauth.OAuthVerifierResolver;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.security.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock MemberRepository memberRepository;
    @Mock OAuthVerifierResolver oAuthVerifierResolver;
    @Mock JwtProvider jwtProvider;
    @Mock MemberOnboardingRepository onboardingRepository;
    @Mock CiProjectRepository ciProjectRepository;
    @Mock BiProjectRepository biProjectRepository;
    AuthService service;

    @BeforeEach void setUp() {
        service = new AuthService(memberRepository, oAuthVerifierResolver, jwtProvider, onboardingRepository,
                ciProjectRepository, biProjectRepository, 14);
    }

    @Test
    void findResumeProjectIdReturnsMostRecentlyUpdatedNonCompletedProject() {
        CiProject project = CiProject.builder().id(1L).publicId("pub-1").status(ProjectStatus.BRIEF_READY).build();
        when(ciProjectRepository.findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(1L, ProjectStatus.COMPLETED))
                .thenReturn(Optional.of(project));

        assertThat(service.findResumeProjectId(1L)).isEqualTo("pub-1");
    }

    @Test
    void findResumeProjectIdReturnsNullWhenNoResumableProject() {
        when(ciProjectRepository.findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(1L, ProjectStatus.COMPLETED))
                .thenReturn(Optional.empty());

        assertThat(service.findResumeProjectId(1L)).isNull();
    }
}
