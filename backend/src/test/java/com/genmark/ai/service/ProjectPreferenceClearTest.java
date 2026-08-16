package com.genmark.ai.service;

import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.web.dto.project.BiProjectUpsertRequest;
import com.genmark.ai.web.dto.project.CiProjectUpsertRequest;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProjectPreferenceClearTest {

    @Test
    void ciCanClearSavedLogoShapeAndLegacyShapeLine() {
        CiProjectRepository repository = mock(CiProjectRepository.class);
        CiProject project = CiProject.builder()
                .publicId("ci-1").industry("TECH").companyName("GenMark")
                .logoShape("달 모양")
                .additionalRequirements("로고 형태: 달 모양\n선은 간결하게")
                .build();
        when(repository.findByPublicIdAndMemberId("ci-1", 1L)).thenReturn(Optional.of(project));

        new CiProjectService(repository).updateStep(
                "ci-1", 1L, "logo-style",
                new CiProjectUpsertRequest(null, null, null, null, null,
                        null, null, null, null, null, "", "로고 형태: 달 모양\n선은 간결하게"));

        assertThat(project.getLogoShape()).isNull();
        assertThat(project.getAdditionalRequirements()).isEqualTo("선은 간결하게");
    }

    @Test
    void biCanClearSavedLogoShapeAndLegacyShapeLine() {
        BiProjectRepository repository = mock(BiProjectRepository.class);
        BiProject project = BiProject.builder()
                .publicId("bi-1").industry("PET").brandName("GenMark")
                .logoShape("하트 모양")
                .additionalRequirements("로고 형태: 하트 모양")
                .build();
        when(repository.findByPublicIdAndMemberId("bi-1", 1L)).thenReturn(Optional.of(project));

        new BiProjectService(repository).updateStep(
                "bi-1", 1L, "logo-style",
                new BiProjectUpsertRequest(null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, "", "로고 형태: 하트 모양"));

        assertThat(project.getLogoShape()).isNull();
        assertThat(project.getAdditionalRequirements()).isNull();
    }
}
