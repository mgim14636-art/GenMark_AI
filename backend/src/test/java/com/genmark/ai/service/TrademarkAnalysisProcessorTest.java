package com.genmark.ai.service;

import com.genmark.ai.client.TrademarkAiClient;
import com.genmark.ai.entity.*;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TrademarkAnalysisProcessorTest {
    @Test
    void passesProjectLogoStyleToAiClient() {
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAiClient aiClient = mock(TrademarkAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().logoStyle("symbol").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().storageKey("logos/c.png").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(1L).candidate(candidate)
                .status(TrademarkAnalysis.Status.QUEUED).build();
        when(analysisRepository.findById(1L)).thenReturn(Optional.of(analysis));
        when(storage.read("logos/c.png")).thenReturn(new byte[]{1, 2, 3});
        TrademarkAiClient.Match first = new TrademarkAiClient.Match("1", "first", "42", 50, "a.png", "외곽선이 유사함");
        TrademarkAiClient.Match second = new TrademarkAiClient.Match("2", "second", "42", 40, "b.png");
        TrademarkAiClient.Match third = new TrademarkAiClient.Match("3", "third", "42", 30, "c.png");
        when(aiClient.search(any(), eq("symbol"), eq(3))).thenReturn(
                new TrademarkAiClient.Result(50, TrademarkAnalysis.RiskLevel.MODERATE,
                        List.of(first, second, third), "notice"));

        new TrademarkAnalysisProcessor(analysisRepository, matchRepository, aiClient, storage,
                mock(LogoCandidateRepository.class)).process(1L);

        assertThat(analysis.getStatus()).isEqualTo(TrademarkAnalysis.Status.SUCCEEDED);
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.COMPLETED);
        verify(aiClient).search(any(), eq("symbol"), eq(3));
        verify(matchRepository, times(3)).save(any());
        ArgumentCaptor<TrademarkMatch> savedMatch = ArgumentCaptor.forClass(TrademarkMatch.class);
        verify(matchRepository, atLeastOnce()).save(savedMatch.capture());
        assertThat(savedMatch.getAllValues().get(0).getNote()).isEqualTo("외곽선이 유사함");
    }

    @Test
    void combinationAnalysisPersistsTwoMatches() {
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAiClient aiClient = mock(TrademarkAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().logoStyle("combination").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().storageKey("logos/c.png").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(1L).candidate(candidate)
                .status(TrademarkAnalysis.Status.QUEUED).build();
        when(analysisRepository.findById(1L)).thenReturn(Optional.of(analysis));
        when(storage.read("logos/c.png")).thenReturn(new byte[]{1, 2, 3});
        TrademarkAiClient.Match first = new TrademarkAiClient.Match("1", "first", "42", 50, "a.png");
        TrademarkAiClient.Match second = new TrademarkAiClient.Match("2", "second", "42", 40, "b.png");
        when(aiClient.search(any(), eq("combination"), eq(3))).thenReturn(
                new TrademarkAiClient.Result(50, TrademarkAnalysis.RiskLevel.MODERATE,
                        List.of(first, second), "notice"));

        new TrademarkAnalysisProcessor(analysisRepository, matchRepository, aiClient, storage,
                mock(LogoCandidateRepository.class)).process(1L);

        assertThat(analysis.getStatus()).isEqualTo(TrademarkAnalysis.Status.SUCCEEDED);
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.COMPLETED);
        verify(aiClient).search(any(), eq("combination"), eq(3));
        verify(matchRepository, times(2)).save(any());
    }

    @Test
    void generatedMatchResolvesNameFromCandidateAndPersistsSource() {
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAiClient aiClient = mock(TrademarkAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        CiProject project = CiProject.builder().logoStyle("combination").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().storageKey("logos/c.png").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(1L).candidate(candidate)
                .status(TrademarkAnalysis.Status.QUEUED).build();
        when(analysisRepository.findById(1L)).thenReturn(Optional.of(analysis));
        when(storage.read("logos/c.png")).thenReturn(new byte[]{1, 2, 3});

        CiProject otherProject = CiProject.builder().companyName("루나코스").build();
        LogoGeneration otherGeneration = LogoGeneration.builder().ciProject(otherProject).build();
        LogoCandidate otherCandidate = LogoCandidate.builder().generation(otherGeneration).build();
        when(candidateRepository.findByPublicId("candidate-xyz")).thenReturn(Optional.of(otherCandidate));

        TrademarkAiClient.Match generated = new TrademarkAiClient.Match("candidate-xyz", "자체 생성 로고",
                "자체 생성 로고", 95, "candidate-xyz", null, TrademarkAiClient.Source.GENERATED);
        when(aiClient.search(any(), eq("combination"), eq(3))).thenReturn(
                new TrademarkAiClient.Result(95, TrademarkAnalysis.RiskLevel.CAUTION, List.of(generated), "notice"));

        new TrademarkAnalysisProcessor(analysisRepository, matchRepository, aiClient, storage, candidateRepository)
                .process(1L);

        ArgumentCaptor<TrademarkMatch> saved = ArgumentCaptor.forClass(TrademarkMatch.class);
        verify(matchRepository).save(saved.capture());
        assertThat(saved.getValue().getSource()).isEqualTo(TrademarkMatch.Source.GENERATED);
        assertThat(saved.getValue().getName()).isEqualTo("루나코스");
    }

    @Test
    void generatedMatchFallsBackToPlaceholderNameWhenCandidateIsGone() {
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAiClient aiClient = mock(TrademarkAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        CiProject project = CiProject.builder().logoStyle("combination").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().storageKey("logos/c.png").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(1L).candidate(candidate)
                .status(TrademarkAnalysis.Status.QUEUED).build();
        when(analysisRepository.findById(1L)).thenReturn(Optional.of(analysis));
        when(storage.read("logos/c.png")).thenReturn(new byte[]{1, 2, 3});
        when(candidateRepository.findByPublicId("deleted-candidate")).thenReturn(Optional.empty());

        TrademarkAiClient.Match generated = new TrademarkAiClient.Match("deleted-candidate", "자체 생성 로고",
                "자체 생성 로고", 95, "deleted-candidate", null, TrademarkAiClient.Source.GENERATED);
        when(aiClient.search(any(), eq("combination"), eq(3))).thenReturn(
                new TrademarkAiClient.Result(95, TrademarkAnalysis.RiskLevel.CAUTION, List.of(generated), "notice"));

        new TrademarkAnalysisProcessor(analysisRepository, matchRepository, aiClient, storage, candidateRepository)
                .process(1L);

        ArgumentCaptor<TrademarkMatch> saved = ArgumentCaptor.forClass(TrademarkMatch.class);
        verify(matchRepository).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("자체 생성 로고");
    }

    @Test
    void emptyMatchesFailWithoutPersistingMatches() {
        TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
        TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
        TrademarkAiClient aiClient = mock(TrademarkAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().logoStyle("combination").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().storageKey("logos/c.png").generation(generation).build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(1L).candidate(candidate)
                .status(TrademarkAnalysis.Status.QUEUED).build();
        when(analysisRepository.findById(1L)).thenReturn(Optional.of(analysis));
        when(storage.read("logos/c.png")).thenReturn(new byte[]{1, 2, 3});
        when(aiClient.search(any(), eq("combination"), eq(3))).thenReturn(
                new TrademarkAiClient.Result(0, TrademarkAnalysis.RiskLevel.SAFE, List.of(), "notice"));

        new TrademarkAnalysisProcessor(analysisRepository, matchRepository, aiClient, storage,
                mock(LogoCandidateRepository.class)).process(1L);

        assertThat(analysis.getStatus()).isEqualTo(TrademarkAnalysis.Status.FAILED);
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.RESULT_READY);
        assertThat(analysis.getErrorCode()).isEqualTo("AI_INVALID_RESPONSE");
        verify(matchRepository, never()).save(any());
    }
}
