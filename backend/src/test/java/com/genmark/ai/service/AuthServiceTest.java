package com.genmark.ai.service;

import com.genmark.ai.entity.Project;
import com.genmark.ai.oauth.OAuthVerifierResolver;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.ProjectRepository;
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
    @Mock ProjectRepository projectRepository;
    AuthService service;

    @BeforeEach void setUp() {
        service = new AuthService(memberRepository, oAuthVerifierResolver, jwtProvider, onboardingRepository, projectRepository, 14);
    }

    @Test
    void findResumeProjectIdReturnsMostRecentlyUpdatedNonCompletedProject() {
        Project project = Project.builder().id(1L).publicId("pub-1").status(Project.Status.BRIEF_READY).build();
        when(projectRepository.findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(1L, Project.Status.COMPLETED))
                .thenReturn(Optional.of(project));

        assertThat(service.findResumeProjectId(1L)).isEqualTo("pub-1");
    }

    @Test
    void findResumeProjectIdReturnsNullWhenNoResumableProject() {
        when(projectRepository.findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(1L, Project.Status.COMPLETED))
                .thenReturn(Optional.empty());

        assertThat(service.findResumeProjectId(1L)).isNull();
    }
}
