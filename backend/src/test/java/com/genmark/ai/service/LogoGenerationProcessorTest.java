package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.client.LogoAiClient;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LogoGenerationProcessorTest {
    @Mock LogoGenerationRepository generationRepository;
    @Mock LogoCandidateRepository candidateRepository;
    @Mock LogoAiClient aiClient;
    @Mock LogoFileStorage storage;
    LogoGenerationProcessor processor;
    LogoGeneration generation;

    @BeforeEach void setUp() {
        processor = new LogoGenerationProcessor(generationRepository, candidateRepository, aiClient, storage, new ObjectMapper());
        generation = LogoGeneration.builder().id(10L).publicId("g").ciProject(CiProject.builder().build())
                .status(LogoGeneration.Status.QUEUED).requestSnapshotJson("{}").build();
        when(generationRepository.findById(10L)).thenReturn(Optional.of(generation));
    }

    private static LogoAiClient.GeneratedLogo logo(String imageBase64) {
        return new LogoAiClient.GeneratedLogo(imageBase64, null, null, null);
    }

    @Test
    void zeroImagesFailWithoutCandidateRows() {
        when(aiClient.generate(any())).thenReturn(
                new LogoAiClient.LogoAiResult(true, "remote/model", List.of()));

        processor.process(10L);

        assertThat(generation.getStatus()).isEqualTo(LogoGeneration.Status.FAILED);
        assertThat(generation.getErrorCode()).isEqualTo("AI_INCOMPLETE_RESULT");
        verifyNoInteractions(storage);
        verify(candidateRepository, never()).save(any());
    }

    @Test
    void exactlyOneImageSucceeds() {
        when(aiClient.generate(any())).thenReturn(
                new LogoAiClient.LogoAiResult(true, "remote/model", List.of(logo("a"))));
        when(storage.store(eq("g"), anyInt(), anyString()))
                .thenReturn(new LogoFileStorage.StoredImage("logos/g/c.png", 512, 512));

        processor.process(10L);

        assertThat(generation.getStatus()).isEqualTo(LogoGeneration.Status.SUCCEEDED);
        assertThat(generation.getProject().getStatus()).isEqualTo(ProjectStatus.RESULT_READY);
        assertThat(generation.getModelName()).isEqualTo("remote/model");
        verify(candidateRepository, times(1)).save(any());
    }

    @Test
    void storesOriginalSvgWithPng() {
        var logo = new LogoAiClient.GeneratedLogo("a", null, null, "<svg><path/></svg>");
        when(aiClient.generate(any())).thenReturn(new LogoAiClient.LogoAiResult(true, "remote/model", List.of(logo)));
        when(storage.store("g", 1, "a"))
                .thenReturn(new LogoFileStorage.StoredImage("logos/g/candidate-1.png", 512, 512));

        processor.process(10L);

        assertThat(generation.getStatus()).isEqualTo(LogoGeneration.Status.SUCCEEDED);
        assertThat(generation.getModelName()).isEqualTo("remote/model");
        verify(storage).storeOriginalSvg("g", 1, "<svg><path/></svg>");
    }
}
