package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.client.SvgRasterizerClient;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class LogoSvgServiceTest {
    @Test
    void readsSvgRevisionRecordedInCandidateMetadataAfterOwnershipCheck() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoSvgService service = new LogoSvgService(projectLookup, candidateRepository, storage,
                mock(SvgRasterizerClient.class), new ObjectMapper());
        CiProject project = CiProject.builder().id(3L).publicId("project-1").build();
        LogoCandidate candidate = candidate(project);
        candidate.setAiMetadataJson("{\"svgRevision\":\"revision-1\"}");
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(storage.readSvg("generation-1", 1, "revision-1"))
                .thenReturn("<svg/>".getBytes(StandardCharsets.UTF_8));

        byte[] result = service.read("project-1", "candidate-1", 7L);

        assertThat(result).isEqualTo("<svg/>".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void savesEditedSvgAndMarksCandidateAvailability() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        SvgRasterizerClient rasterizerClient = mock(SvgRasterizerClient.class);
        LogoSvgService service = new LogoSvgService(projectLookup, candidateRepository, storage,
                rasterizerClient, new ObjectMapper());
        CiProject project = CiProject.builder().id(3L).publicId("project-1").build();
        LogoCandidate candidate = candidate(project);
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(rasterizerClient.rasterize("<svg><path/></svg>")).thenReturn("png-base64");
        when(storage.storeEditedAssets("generation-1", 1, "<svg><path/></svg>", "png-base64"))
                .thenReturn(new LogoFileStorage.StoredEditedAsset(
                        "logos/generation-1/candidate-1-revision-1.png", "revision-1", 1024, 1024));

        service.saveEdited("project-1", "candidate-1", 7L, "<svg><path/></svg>");

        assertThat(candidate.getStorageKey()).isEqualTo("logos/generation-1/candidate-1-revision-1.png");
        assertThat(candidate.getWidth()).isEqualTo(1024);
        assertThat(candidate.getHeight()).isEqualTo(1024);
        assertThat(candidate.getAiMetadataJson()).contains("\"svgRevision\":\"revision-1\"");
    }

    @Test
    void ownershipFailureDoesNotReadPrivateStorage() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoSvgService service = new LogoSvgService(projectLookup, candidateRepository, storage,
                mock(SvgRasterizerClient.class), new ObjectMapper());
        when(projectLookup.requireOwned("project-1", 7L))
                .thenThrow(new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        assertThatThrownBy(() -> service.read("project-1", "candidate-1", 7L))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(candidateRepository, storage);
    }

    private LogoCandidate candidate(CiProject project) {
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1").ciProject(project).build();
        return LogoCandidate.builder().publicId("candidate-1").generation(generation).candidateOrder(1).build();
    }
}
