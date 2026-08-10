package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TrademarkMatchResponseTest {
    @Test
    void matchResponseIncludesAuthenticatedImageUrl() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAnalysisService service = new TrademarkAnalysisService(projectLookup, null, null, null,
                analysisRepository, matchRepository, null);
        CiProject project = CiProject.builder().publicId("project-1").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(11L).publicId("analysis-1").candidate(candidate).build();
        TrademarkMatch match = TrademarkMatch.builder().analysis(analysis).rank(3).imagePath("raw/sample.jpg").build();
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdOrderByRank(11L)).thenReturn(List.of(match));

        var response = service.matches("project-1", "analysis-1", 7L).get(0);

        assertThat(response.imageUrl()).isEqualTo(
                "/api/v1/projects/project-1/trademark-analyses/analysis-1/matches/3/image");
        assertThat(response.imagePath()).isEqualTo("raw/sample.jpg");
    }
}
