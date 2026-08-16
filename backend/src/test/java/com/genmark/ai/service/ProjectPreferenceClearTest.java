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

    @Test
    void ciPaletteReplaceRemovesStaleTrailingColors() {
        CiProjectRepository repository = mock(CiProjectRepository.class);
        CiProject project = CiProject.builder()
                .publicId("ci-2").industry("TECH").companyName("GenMark")
                .colorMode("MANUAL")
                .color1("#111111").color2("#222222").color3("#333333").color4("#444444")
                .build();
        when(repository.findByPublicIdAndMemberId("ci-2", 1L)).thenReturn(Optional.of(project));

        new CiProjectService(repository).update(
                "ci-2", 1L,
                new CiProjectUpsertRequest(null, null, null, null, "MANUAL",
                        "#AAAAAA", "#BBBBBB", null, null, null, null, null, true));

        assertThat(project.colorList()).containsExactly("#AAAAAA", "#BBBBBB");
    }

    @Test
    void biTonePaletteReplaceClearsAllManualColors() {
        BiProjectRepository repository = mock(BiProjectRepository.class);
        BiProject project = BiProject.builder()
                .publicId("bi-2").industry("PET").brandName("GenMark")
                .colorMode("MANUAL")
                .color1("#111111").color2("#222222")
                .build();
        when(repository.findByPublicIdAndMemberId("bi-2", 1L)).thenReturn(Optional.of(project));

        new BiProjectService(repository).update(
                "bi-2", 1L,
                new BiProjectUpsertRequest(null, null, null, null, null, null, null, "따뜻한",
                        "TONE", null, null, null, null, null, null, null, true));

        assertThat(project.getColorMode()).isEqualTo("TONE");
        assertThat(project.colorList()).isEmpty();
    }
}
