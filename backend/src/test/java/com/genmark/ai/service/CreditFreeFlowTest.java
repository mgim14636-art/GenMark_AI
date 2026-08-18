package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.MemberRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CreditFreeFlowTest {

    @Test
    void allowsLogoGenerationWhenMemberHasNoCredits() {
        Member member = Member.builder().id(1L).creditBalance(0).build();
        CiProject project = ciProject(member);

        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        CiProjectRepository ciProjectRepository = mock(CiProjectRepository.class);
        BiProjectRepository biProjectRepository = mock(BiProjectRepository.class);
        LogoGenerationRepository generationRepository = mock(LogoGenerationRepository.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoGenerationWorker worker = mock(LogoGenerationWorker.class);

        when(projectLookup.requireOwned(project.getPublicId(), member.getId())).thenReturn(project);
        when(generationRepository.findByCiProjectIdAndIdempotencyKey(project.getId(), "credit-free"))
                .thenReturn(Optional.empty());
        when(generationRepository.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(
                project.getId(), LogoGeneration.Status.SUCCEEDED)).thenReturn(Optional.empty());
        when(generationRepository.save(any(LogoGeneration.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LogoGenerationService service = new LogoGenerationService(
                projectLookup,
                ciProjectRepository,
                biProjectRepository,
                generationRepository,
                candidateRepository,
                worker,
                mock(CreditService.class),
                new ObjectMapper());

        var response = service.create(project.getPublicId(), member.getId(), "credit-free");

        assertThat(response.status()).isEqualTo(LogoGeneration.Status.QUEUED);
        assertThat(member.getCreditBalance()).isZero();
        verify(generationRepository).save(any(LogoGeneration.class));
    }

    @Test
    void allowsFirstDownloadWhenMemberHasNoCredits() {
        Member member = Member.builder().id(1L).creditBalance(0).build();
        CiProject project = ciProject(member);
        LogoGeneration generation = LogoGeneration.builder()
                .id(3L)
                .publicId("generation-1")
                .status(LogoGeneration.Status.SUCCEEDED)
                .requestSnapshotJson("{}")
                .idempotencyKey("generation-key")
                .build();
        generation.setProject(project);
        LogoCandidate candidate = LogoCandidate.builder()
                .id(4L)
                .publicId("candidate-1")
                .generation(generation)
                .candidateOrder(1)
                .storageKey("logos/generation-1/candidate-1.png")
                .build();

        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoDownloadRepository downloadRepository = mock(LogoDownloadRepository.class);
        MemberRepository memberRepository = mock(MemberRepository.class);
        LogoFileStorage fileStorage = mock(LogoFileStorage.class);

        when(projectLookup.requireOwned(project.getPublicId(), member.getId())).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                candidate.getPublicId(), project.getId(), member.getId())).thenReturn(Optional.of(candidate));
        when(downloadRepository.findByMemberIdAndCandidateId(member.getId(), candidate.getId()))
                .thenReturn(Optional.empty());
        when(memberRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(fileStorage.archiveForDownload(member.getId(), candidate.getPublicId(), candidate.getStorageKey()))
                .thenReturn("downloads/1/candidate-1.png");
        when(downloadRepository.save(any(LogoDownload.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(downloadRepository.findByMemberIdAndProjectTypeOrderByDownloadedAtAsc(
                member.getId(), LogoDownload.ProjectType.CI)).thenReturn(List.of());

        LogoDownloadService service = new LogoDownloadService(
                projectLookup,
                candidateRepository,
                downloadRepository,
                memberRepository,
                fileStorage,
                20);

        var response = service.download(project.getPublicId(), candidate.getPublicId(), member.getId());

        assertThat(response.firstTime()).isTrue();
        assertThat(member.getCreditBalance()).isZero();
        verify(downloadRepository).save(any(LogoDownload.class));
    }

    private CiProject ciProject(Member member) {
        return CiProject.builder()
                .id(2L)
                .publicId("ci-project-1")
                .member(member)
                .status(ProjectStatus.BRIEF_READY)
                .industry("TECH")
                .companyName("GenMark")
                .tone("modern")
                .color1("#112233")
                .color2("#445566")
                .logoStyle("symbol")
                .build();
    }
}
