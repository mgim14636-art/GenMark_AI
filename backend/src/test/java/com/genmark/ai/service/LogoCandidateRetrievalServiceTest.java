package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LogoCandidateRetrievalServiceTest {
    private static final Long MEMBER_ID = 7L;
    private static final Long PROJECT_ID = 10L;

    private ProjectLookupService projectLookup;
    private LogoGenerationRepository generationRepository;
    private LogoCandidateRepository candidateRepository;
    private LogoGenerationService service;
    private CiProject project;

    @BeforeEach
    void setUp() {
        projectLookup = mock(ProjectLookupService.class);
        generationRepository = mock(LogoGenerationRepository.class);
        candidateRepository = mock(LogoCandidateRepository.class);
        service = new LogoGenerationService(projectLookup, mock(CiProjectRepository.class), mock(BiProjectRepository.class),
                generationRepository, candidateRepository, mock(LogoGenerationWorker.class), mock(CreditService.class), new ObjectMapper());
        project = CiProject.builder().id(PROJECT_ID).publicId("project-1").build();
        when(projectLookup.requireOwned("project-1", MEMBER_ID)).thenReturn(project);
    }

    @Test
    void returnsOnlyCandidatesForRequestedGenerationInCandidateOrder() {
        LogoGeneration requested = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(requested));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(candidates(requested, "new"));

        var result = service.candidates("project-1", "generation-2", MEMBER_ID);

        assertThat(result).extracting(candidate -> candidate.id())
                .containsExactly("new-1");
        assertThat(result).extracting(candidate -> candidate.order())
                .containsExactly(1);
        assertThat(result.get(0).svgUrl()).isEqualTo(
                "/api/v1/projects/project-1/logo-candidates/new-1/svg");
        verify(candidateRepository).findByGenerationIdOrderByCandidateOrder(22L);
    }

    @Test
    void doesNotMixCandidatesFromEarlierGenerationInSameProject() {
        LogoGeneration latest = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(latest));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(candidates(latest, "latest"));

        var result = service.candidates("project-1", "generation-2", MEMBER_ID);

        assertThat(result).hasSize(1);
        assertThat(result).allMatch(candidate -> candidate.id().startsWith("latest-"));
    }

    @Test
    void returnsNotFoundWhenGenerationBelongsToAnotherProject() {
        when(generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(
                "generation-other-project", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.candidates("project-1", "generation-other-project", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void returnsNotFoundWhenGenerationBelongsToAnotherMember() {
        when(generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(
                "generation-other-member", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.candidates("project-1", "generation-other-member", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void rejectsIncompleteCandidateSetForSucceededGeneration() {
        LogoGeneration generation = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(generation));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.candidates("project-1", "generation-2", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_INCOMPLETE_RESULT));
    }

    @Test
    void returnsOwnedCandidateByIdEvenWhenItIsFromAnEarlierGeneration() {
        LogoGeneration earlierGeneration = succeededGeneration(18L, "generation-1");
        LogoCandidate savedCandidate = candidates(earlierGeneration, "saved").get(0);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "saved-1", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(savedCandidate));

        var result = service.candidate("project-1", "saved-1", MEMBER_ID);

        assertThat(result.id()).isEqualTo("saved-1");
        assertThat(result.storageKey()).contains("generation-1");
    }

    @Test
    void rejectsCandidateFromIncompleteGeneration() {
        LogoGeneration running = LogoGeneration.builder()
                .id(23L)
                .publicId("generation-running")
                .ciProject(project)
                .status(LogoGeneration.Status.RUNNING)
                .build();
        LogoCandidate candidate = candidates(running, "running").get(0);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "running-1", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.candidate("project-1", "running-1", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_CONFLICT));
    }

    @Test
    void returnsAllSucceededCandidatesAcrossCiBiAndRegenerationsNewestFirst() {
        CiProject ciProject = CiProject.builder().id(PROJECT_ID).publicId("ci-project").build();
        BiProject biProject = BiProject.builder().id(20L).publicId("bi-project").build();
        LogoGeneration earlierCi = succeededGeneration(31L, "ci-generation-1", ciProject);
        LogoGeneration latestCi = succeededGeneration(32L, "ci-generation-2", ciProject);
        LogoGeneration biGeneration = succeededGeneration(33L, "bi-generation-1", biProject);
        LogoCandidate earlier = candidate(earlierCi, "ci-earlier", LocalDateTime.of(2026, 8, 20, 9, 0));
        LogoCandidate latest = candidate(latestCi, "ci-latest", LocalDateTime.of(2026, 8, 20, 11, 0));
        LogoCandidate bi = candidate(biGeneration, "bi-candidate", LocalDateTime.of(2026, 8, 20, 10, 0));

        when(candidateRepository.findByGenerationCiProjectMemberIdAndGenerationStatusOrderByCreatedAtDesc(
                MEMBER_ID, LogoGeneration.Status.SUCCEEDED)).thenReturn(List.of(latest, earlier));
        when(candidateRepository.findByGenerationBiProjectMemberIdAndGenerationStatusOrderByCreatedAtDesc(
                MEMBER_ID, LogoGeneration.Status.SUCCEEDED)).thenReturn(List.of(bi));

        var result = service.myCandidates(MEMBER_ID);

        assertThat(result).extracting(candidate -> candidate.id())
                .containsExactly("ci-latest", "bi-candidate", "ci-earlier");
        assertThat(result).extracting(candidate -> candidate.projectId())
                .containsExactly("ci-project", "bi-project", "ci-project");
        assertThat(result).extracting(candidate -> candidate.projectType())
                .containsExactly("CI", "BI", "CI");
    }

    private LogoGeneration succeededGeneration(Long id, String publicId) {
        return succeededGeneration(id, publicId, project);
    }

    private LogoGeneration succeededGeneration(Long id, String publicId, com.genmark.ai.entity.ProjectLike owner) {
        LogoGeneration generation = LogoGeneration.builder()
                .id(id)
                .publicId(publicId)
                .status(LogoGeneration.Status.SUCCEEDED)
                .completedAt(LocalDateTime.now())
                .build();
        generation.setProject(owner);
        return generation;
    }

    private LogoCandidate candidate(LogoGeneration generation, String publicId, LocalDateTime createdAt) {
        return LogoCandidate.builder()
                .publicId(publicId)
                .generation(generation)
                .candidateOrder(1)
                .storageKey("logos/" + generation.getPublicId() + "/candidate-1.png")
                .mimeType("image/png")
                .aiMetadataJson("{\"svgAvailable\":true}")
                .createdAt(createdAt)
                .build();
    }

    private List<LogoCandidate> candidates(LogoGeneration generation, String prefix) {
        return java.util.stream.IntStream.rangeClosed(1, 1)
                .mapToObj(order -> LogoCandidate.builder()
                        .publicId(prefix + "-" + order)
                        .generation(generation)
                        .candidateOrder(order)
                        .storageKey("logos/" + generation.getPublicId() + "/candidate-" + order + ".png")
                        .mimeType("image/png")
                        .aiMetadataJson("{\"svgAvailable\":true}")
                        .createdAt(LocalDateTime.now())
                        .build())
                .toList();
    }
}
