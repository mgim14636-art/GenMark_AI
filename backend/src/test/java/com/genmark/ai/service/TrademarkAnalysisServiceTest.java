package com.genmark.ai.service;

import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.web.dto.trademark.TrademarkAnalysisResponse;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

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
}
