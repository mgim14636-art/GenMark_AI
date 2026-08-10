package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Project;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.ProjectRepository;
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

    private ProjectService projectService;
    private LogoGenerationRepository generationRepository;
    private LogoCandidateRepository candidateRepository;
    private LogoGenerationService service;
    private Project project;

    @BeforeEach
    void setUp() {
        projectService = mock(ProjectService.class);
        generationRepository = mock(LogoGenerationRepository.class);
        candidateRepository = mock(LogoCandidateRepository.class);
        service = new LogoGenerationService(projectService, mock(ProjectRepository.class), generationRepository,
                candidateRepository, mock(LogoGenerationWorker.class), new ObjectMapper());
        project = Project.builder().id(PROJECT_ID).publicId("project-1").build();
        when(projectService.requireOwned("project-1", MEMBER_ID)).thenReturn(project);
    }

    @Test
    void returnsOnlyCandidatesForRequestedGenerationInCandidateOrder() {
        LogoGeneration requested = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndProjectIdAndProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(requested));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(candidates(requested, "new"));

        var result = service.candidates("project-1", "generation-2", MEMBER_ID);

        assertThat(result).extracting(candidate -> candidate.id())
                .containsExactly("new-1", "new-2", "new-3", "new-4");
        assertThat(result).extracting(candidate -> candidate.order())
                .containsExactly(1, 2, 3, 4);
        verify(candidateRepository).findByGenerationIdOrderByCandidateOrder(22L);
    }

    @Test
    void doesNotMixCandidatesFromEarlierGenerationInSameProject() {
        LogoGeneration latest = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndProjectIdAndProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(latest));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(candidates(latest, "latest"));

        var result = service.candidates("project-1", "generation-2", MEMBER_ID);

        assertThat(result).hasSize(4);
        assertThat(result).allMatch(candidate -> candidate.id().startsWith("latest-"));
    }

    @Test
    void returnsNotFoundWhenGenerationBelongsToAnotherProject() {
        when(generationRepository.findByPublicIdAndProjectIdAndProjectMemberId(
                "generation-other-project", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.candidates("project-1", "generation-other-project", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void returnsNotFoundWhenGenerationBelongsToAnotherMember() {
        when(generationRepository.findByPublicIdAndProjectIdAndProjectMemberId(
                "generation-other-member", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.candidates("project-1", "generation-other-member", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void rejectsIncompleteCandidateSetForSucceededGeneration() {
        LogoGeneration generation = succeededGeneration(22L, "generation-2");
        when(generationRepository.findByPublicIdAndProjectIdAndProjectMemberId(
                "generation-2", PROJECT_ID, MEMBER_ID)).thenReturn(Optional.of(generation));
        when(candidateRepository.findByGenerationIdOrderByCandidateOrder(22L))
                .thenReturn(candidates(generation, "incomplete").subList(0, 3));

        assertThatThrownBy(() -> service.candidates("project-1", "generation-2", MEMBER_ID))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_INCOMPLETE_RESULT));
    }

    private LogoGeneration succeededGeneration(Long id, String publicId) {
        return LogoGeneration.builder()
                .id(id)
                .publicId(publicId)
                .project(project)
                .status(LogoGeneration.Status.SUCCEEDED)
                .candidateCount(4)
                .completedAt(LocalDateTime.now())
                .build();
    }

    private List<LogoCandidate> candidates(LogoGeneration generation, String prefix) {
        return java.util.stream.IntStream.rangeClosed(1, 4)
                .mapToObj(order -> LogoCandidate.builder()
                        .publicId(prefix + "-" + order)
                        .generation(generation)
                        .candidateOrder(order)
                        .storageKey("logos/" + generation.getPublicId() + "/candidate-" + order + ".png")
                        .mimeType("image/png")
                        .createdAt(LocalDateTime.now())
                        .build())
                .toList();
    }
}
