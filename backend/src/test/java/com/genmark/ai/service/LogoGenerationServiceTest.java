package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.Project;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.ProjectRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LogoGenerationServiceTest {
    @Test
    void mapsProjectToLatestSurveyContract() {
        ProjectService projectService = mock(ProjectService.class);
        LogoGenerationService service = new LogoGenerationService(projectService, mock(ProjectRepository.class),
                mock(LogoGenerationRepository.class), mock(LogoCandidateRepository.class),
                mock(LogoGenerationWorker.class), new ObjectMapper());
        Project project = Project.builder().brandType("BI").brandName("GenMark").industry("IT")
                .brandValuesJson("[\"TRUST\"]").brandValuesText("reliable").targetAge("20s")
                .tone("modern").colorMode("MANUAL").colorsJson("[\"#112233\"]")
                .logoStyle("combination").includeBrandName(true).additionalRequirements("simple").build();
        when(projectService.readList("[\"TRUST\"]")).thenReturn(List.of("TRUST"));
        when(projectService.readList("[\"#112233\"]")).thenReturn(List.of("#112233"));

        Map<String, Object> survey = service.toSurvey(project);

        assertThat(survey).containsEntry("ci_bi", "BI")
                .containsEntry("brand_name", "GenMark")
                .containsEntry("style", "combination")
                .containsEntry("include_brand_name_in_logo", true)
                .containsEntry("color_manual", List.of("#112233"))
                .containsEntry("num_variants", 4);
    }

    @Test
    void mapsCompanyNameForCiGeneration() {
        ProjectService projectService = mock(ProjectService.class);
        LogoGenerationService service = new LogoGenerationService(projectService, mock(ProjectRepository.class),
                mock(LogoGenerationRepository.class), mock(LogoCandidateRepository.class),
                mock(LogoGenerationWorker.class), new ObjectMapper());
        Project project = Project.builder().brandType("CI").companyName("GenMark Company")
                .brandValuesJson("[]").colorsJson("[]").includeBrandName(true).build();
        when(projectService.readList("[]")).thenReturn(List.of());

        Map<String, Object> survey = service.toSurvey(project);

        assertThat(survey).containsEntry("ci_bi", "CI")
                .containsEntry("company_name", "GenMark Company");
    }
}
