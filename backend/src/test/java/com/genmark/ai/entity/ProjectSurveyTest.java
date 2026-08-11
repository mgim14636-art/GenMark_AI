package com.genmark.ai.entity;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectSurveyTest {
    @Test
    void biProjectSurveyContainsBrandNameAndColors() {
        BiProject project = BiProject.builder().brandName("GenMark").industry("IT")
                .brandDescription("reliable").targetAge("전 연령층")
                .tone("modern").color1("#112233").logoStyle("combination")
                .additionalRequirements("simple").build();

        Map<String, Object> survey = project.toSurvey();

        assertThat(survey).containsEntry("ci_bi", "BI")
                .containsEntry("brand_name", "GenMark")
                .containsEntry("style", "combination")
                .containsEntry("color_manual", List.of("#112233"))
                .containsEntry("num_variants", 4);
    }

    @Test
    void ciProjectSurveyContainsCompanyName() {
        CiProject project = CiProject.builder().companyName("GenMark Company").industry("IT")
                .tone("friendly").color1("#ffffff").logoStyle("combination").build();

        Map<String, Object> survey = project.toSurvey();

        assertThat(survey).containsEntry("ci_bi", "CI")
                .containsEntry("company_name", "GenMark Company");
    }
}
