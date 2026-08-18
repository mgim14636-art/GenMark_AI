package com.genmark.ai.service;

import com.genmark.ai.entity.*;
import com.genmark.ai.repository.*;
import com.genmark.ai.web.dto.trademark.TrademarkAnalysisResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TrademarkAnalysisServiceTest {
    @Test
    void mapsRiskLabelsWithoutRecalculatingScore() {
        TrademarkAnalysisService service = new TrademarkAnalysisService(
                mock(ProjectLookupService.class), null, null, null, null, null, null);
        var project = com.genmark.ai.entity.CiProject.builder().publicId("p").build();
        var generation = com.genmark.ai.entity.LogoGeneration.builder().ciProject(project).build();
        var candidate = com.genmark.ai.entity.LogoCandidate.builder().publicId("c").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().publicId("a").candidate(candidate)
                .status(TrademarkAnalysis.Status.SUCCEEDED).maxSimilarity(73)
                .riskLevel(TrademarkAnalysis.RiskLevel.CAUTION).build();

        TrademarkAnalysisResponse response = service.toResponse(analysis);

        assertThat(response.maxSimilarity()).isEqualTo(73);
        assertThat(response.riskLabel()).isEqualTo("주의");
    }
    @Test
    void rejectsUnsupportedLogoStyleBeforeCreatingAnalysis() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        CiProjectRepository ciProjectRepository = mock(CiProjectRepository.class);
        BiProjectRepository biProjectRepository = mock(BiProjectRepository.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAnalysisWorker worker = mock(TrademarkAnalysisWorker.class);
        TrademarkAnalysisService service = new TrademarkAnalysisService(projectLookup, ciProjectRepository,
                biProjectRepository, candidateRepository, analysisRepository, matchRepository, worker);
        CiProject project = CiProject.builder().id(1L).publicId("project-1")
                .logoStyle("symbol").status(ProjectStatus.RESULT_READY).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);

        assertThatThrownBy(() -> service.create("project-1", 7L))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(ex.getMessage()).isEqualTo("현재 상표 분석은 조합형 로고만 지원합니다.");
                });

        verifyNoInteractions(candidateRepository, analysisRepository, worker);
    }
}
