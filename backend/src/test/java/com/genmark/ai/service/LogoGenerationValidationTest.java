package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LogoGenerationValidationTest {

    @Test
    void returnsExistingIdempotentGenerationBeforeRevalidatingChangedProject() {
        CiProject project = CiProject.builder().id(1L).publicId("ci-idempotent")
                .companyName("GenMark").industry("LEGACY_VALUE").logoStyle("symbol").build();
        LogoGeneration existing = LogoGeneration.builder().publicId("generation-existing")
                .status(LogoGeneration.Status.SUCCEEDED).idempotencyKey("same-key")
                .requestSnapshotJson("{}").build();
        existing.setProject(project);

        ProjectLookupService lookup = mock(ProjectLookupService.class);
        LogoGenerationRepository generationRepository = mock(LogoGenerationRepository.class);
        LogoGenerationWorker worker = mock(LogoGenerationWorker.class);
        when(lookup.requireOwned("ci-idempotent", 7L)).thenReturn(project);
        when(generationRepository.findByCiProjectIdAndIdempotencyKey(1L, "same-key"))
                .thenReturn(java.util.Optional.of(existing));
        CreditService creditService = mock(CreditService.class);
        LogoGenerationService service = new LogoGenerationService(
                lookup,
                mock(CiProjectRepository.class),
                mock(BiProjectRepository.class),
                generationRepository,
                mock(LogoCandidateRepository.class),
                worker,
                creditService,
                new ObjectMapper());

        var response = service.create("ci-idempotent", 7L, "same-key");

        assertThat(response.id()).isEqualTo("generation-existing");
        verifyNoInteractions(worker);
        verifyNoInteractions(creditService);
    }

    @Test
    void regenerationDoesNotConsumeCreditBeforeSavingGeneration() {
        CiProject project = CiProject.builder().id(2L).publicId("ci-regenerate")
                .companyName("GenMark").industry("TECH").logoStyle("symbol").build();
        LogoGeneration previous = LogoGeneration.builder().status(LogoGeneration.Status.SUCCEEDED).build();
        previous.setProject(project);
        ProjectLookupService lookup = mock(ProjectLookupService.class);
        LogoGenerationRepository generations = mock(LogoGenerationRepository.class);
        CreditService credits = mock(CreditService.class);
        when(lookup.requireOwned("ci-regenerate", 7L)).thenReturn(project);
        when(generations.findByCiProjectIdAndIdempotencyKey(2L, "retry-key"))
                .thenReturn(java.util.Optional.empty());
        when(generations.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(2L, LogoGeneration.Status.SUCCEEDED))
                .thenReturn(java.util.Optional.of(previous));
        when(generations.save(org.mockito.ArgumentMatchers.any(LogoGeneration.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        LogoGenerationService service = new LogoGenerationService(lookup, mock(CiProjectRepository.class),
                mock(BiProjectRepository.class), generations, mock(LogoCandidateRepository.class),
                mock(LogoGenerationWorker.class), credits, new ObjectMapper());

        service.create("ci-regenerate", 7L, "retry-key");

        verifyNoInteractions(credits);
        verify(generations).save(org.mockito.ArgumentMatchers.any(LogoGeneration.class));
    }

    @Test
    void regenerationQueuesGenerationEvenWithoutCredits() {
        CiProject project = CiProject.builder().id(3L).publicId("ci-no-credit")
                .companyName("GenMark").industry("TECH").logoStyle("symbol").build();
        LogoGeneration previous = LogoGeneration.builder().status(LogoGeneration.Status.SUCCEEDED).build();
        previous.setProject(project);
        ProjectLookupService lookup = mock(ProjectLookupService.class);
        LogoGenerationRepository generations = mock(LogoGenerationRepository.class);
        LogoGenerationWorker worker = mock(LogoGenerationWorker.class);
        CreditService credits = mock(CreditService.class);
        when(lookup.requireOwned("ci-no-credit", 7L)).thenReturn(project);
        when(generations.findByCiProjectIdAndIdempotencyKey(3L, "no-credit"))
                .thenReturn(java.util.Optional.empty());
        when(generations.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(3L, LogoGeneration.Status.SUCCEEDED))
                .thenReturn(java.util.Optional.of(previous));
        when(generations.save(org.mockito.ArgumentMatchers.any(LogoGeneration.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        LogoGenerationService service = new LogoGenerationService(lookup, mock(CiProjectRepository.class),
                mock(BiProjectRepository.class), generations, mock(LogoCandidateRepository.class), worker,
                credits, new ObjectMapper());

        var response = service.create("ci-no-credit", 7L, "no-credit");

        assertThat(response.status()).isEqualTo(LogoGeneration.Status.QUEUED);
        verify(generations).save(org.mockito.ArgumentMatchers.any(LogoGeneration.class));
        verifyNoInteractions(credits);
    }

    @Test
    void rejectsUnsupportedIndustryBeforeCallingAi() {
        CiProject project = CiProject.builder().id(1L).publicId("ci-1")
                .companyName("GenMark").industry("UNKNOWN").logoStyle("symbol").build();

        assertValidationError(project, "지원하지 않는 업종");
    }

    @Test
    void rejectsUnsupportedBiTargetAgeBeforeCallingAi() {
        BiProject project = BiProject.builder().id(2L).publicId("bi-1")
                .brandName("GenMark").industry("TECH").targetAge("20대")
                .logoStyle("combination").build();

        assertValidationError(project, "지원하지 않는 타깃 연령");
    }

    @Test
    void rejectsManualColorModeWithoutAHexColor() {
        CiProject project = CiProject.builder().id(3L).publicId("ci-2")
                .companyName("GenMark").industry("TECH").logoStyle("symbol")
                .colorMode("MANUAL").build();

        assertValidationError(project, "직접 선택 색상");
    }

    private void assertValidationError(ProjectLike project, String message) {
        ProjectLookupService lookup = mock(ProjectLookupService.class);
        when(lookup.requireOwned(project.getPublicId(), 7L)).thenReturn(project);
        LogoGenerationService service = new LogoGenerationService(
                lookup,
                mock(CiProjectRepository.class),
                mock(BiProjectRepository.class),
                mock(LogoGenerationRepository.class),
                mock(LogoCandidateRepository.class),
                mock(LogoGenerationWorker.class),
                mock(CreditService.class),
                new ObjectMapper());

        assertThatThrownBy(() -> service.create(project.getPublicId(), 7L, "validation-test"))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(ex.getMessage()).contains(message);
                });
    }
}
