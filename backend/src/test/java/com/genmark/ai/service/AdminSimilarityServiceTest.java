package com.genmark.ai.service;

import com.genmark.ai.client.EmbeddingAiClient;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.GeneratedLogoVector;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.repository.GeneratedLogoVectorRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.admin.AdminSimilarityCompareResponse;
import com.genmark.ai.web.dto.admin.AdminSimilarityVectorRow;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminSimilarityServiceTest {

    @Mock LogoCandidateRepository candidateRepository;
    @Mock GeneratedLogoVectorRepository vectorRepository;
    @Mock EmbeddingAiClient embeddingClient;
    @Mock LogoFileStorage storage;

    private AdminSimilarityService service() {
        return new AdminSimilarityService(candidateRepository, vectorRepository, embeddingClient, storage);
    }

    private LogoCandidate ciCandidate(long id, String publicId, String storageKey) {
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).companyName("Cosmatics").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        return LogoCandidate.builder().id(id).publicId(publicId).generation(generation).storageKey(storageKey).build();
    }

    @Test
    void vectorizesNewCandidateByRegisteringWithAiServer() {
        AdminSimilarityService service = service();
        LogoCandidate candidate = ciCandidate(4L, "candidate-1", "logos/candidate-1.png");
        when(candidateRepository.findByPublicId("candidate-1")).thenReturn(Optional.of(candidate));
        when(vectorRepository.findByCandidateId(4L)).thenReturn(Optional.empty());
        when(storage.read("logos/candidate-1.png")).thenReturn("png-bytes".getBytes());
        when(vectorRepository.save(any(GeneratedLogoVector.class))).thenAnswer(invocation -> {
            GeneratedLogoVector saved = invocation.getArgument(0);
            saved.setId(10L);
            saved.setVectorizedAt(LocalDateTime.of(2026, 8, 25, 10, 0));
            return saved;
        });

        AdminSimilarityVectorRow row = service.vectorize("candidate-1");

        assertThat(row.id()).isEqualTo(10L);
        assertThat(row.candidateId()).isEqualTo("candidate-1");
        assertThat(row.projectId()).isEqualTo("project-1");
        assertThat(row.projectType()).isEqualTo("CI");
        assertThat(row.name()).isEqualTo("Cosmatics");
        assertThat(row.imageUrl()).isEqualTo("/api/v1/admin/candidates/candidate-1/image");
        assertThat(row.vectorizedAt()).isEqualTo("2026.08.25");

        verify(embeddingClient).register(anyString(), eq("candidate-1"));
    }

    @Test
    void vectorizeReturnsExistingRowWithoutCallingAiAgain() {
        AdminSimilarityService service = service();
        LogoCandidate candidate = ciCandidate(4L, "candidate-1", "logos/candidate-1.png");
        GeneratedLogoVector existing = GeneratedLogoVector.builder().id(9L).candidate(candidate)
                .vectorizedAt(LocalDateTime.of(2026, 8, 20, 9, 0)).build();
        when(candidateRepository.findByPublicId("candidate-1")).thenReturn(Optional.of(candidate));
        when(vectorRepository.findByCandidateId(4L)).thenReturn(Optional.of(existing));

        AdminSimilarityVectorRow row = service.vectorize("candidate-1");

        assertThat(row.id()).isEqualTo(9L);
        verifyNoInteractions(embeddingClient);
        verify(vectorRepository, never()).save(any());
    }

    @Test
    void vectorizeThrowsWhenCandidateNotFound() {
        AdminSimilarityService service = service();
        when(candidateRepository.findByPublicId("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.vectorize("missing"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void listsVectorsInRepositoryOrder() {
        AdminSimilarityService service = service();
        LogoCandidate ci = ciCandidate(4L, "candidate-1", "logos/candidate-1.png");
        Member member = Member.builder().id(8L).build();
        BiProject biProject = BiProject.builder().id(5L).publicId("project-2").member(member).brandName("Luneria").build();
        LogoCandidate bi = LogoCandidate.builder().id(6L).publicId("candidate-2")
                .generation(LogoGeneration.builder().biProject(biProject).build())
                .storageKey("logos/candidate-2.png").build();
        GeneratedLogoVector newer = GeneratedLogoVector.builder().id(11L).candidate(bi)
                .vectorizedAt(LocalDateTime.of(2026, 8, 25, 9, 0)).build();
        GeneratedLogoVector older = GeneratedLogoVector.builder().id(10L).candidate(ci)
                .vectorizedAt(LocalDateTime.of(2026, 8, 20, 9, 0)).build();
        when(vectorRepository.findAllByOrderByVectorizedAtDesc()).thenReturn(List.of(newer, older));

        List<AdminSimilarityVectorRow> rows = service.list();

        assertThat(rows).extracting(AdminSimilarityVectorRow::id).containsExactly(11L, 10L);
        assertThat(rows.get(0).projectType()).isEqualTo("BI");
        assertThat(rows.get(0).name()).isEqualTo("Luneria");
    }

    @Test
    void compareDelegatesToAiServerUsingCandidatePublicId() {
        AdminSimilarityService service = service();
        LogoCandidate candidate = ciCandidate(4L, "candidate-1", "logos/candidate-1.png");
        GeneratedLogoVector stored = GeneratedLogoVector.builder().id(10L).candidate(candidate)
                .vectorizedAt(LocalDateTime.now()).build();
        when(vectorRepository.findById(10L)).thenReturn(Optional.of(stored));
        when(storage.read("logos/candidate-1.png")).thenReturn("png-bytes".getBytes());
        AdminSimilarityCompareResponse expected = new AdminSimilarityCompareResponse(41, "MODERATE", "disclaimer text", "원형 배치가 비슷해요");
        when(embeddingClient.compareById(eq("candidate-1"), anyString(), eq("comparison-image-base64"))).thenReturn(expected);

        AdminSimilarityCompareResponse response = service.compare(10L, "comparison-image-base64");

        assertThat(response).isEqualTo(expected);
    }

    @Test
    void compareThrowsWhenVectorIdNotFound() {
        AdminSimilarityService service = service();
        when(vectorRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.compare(99L, "comparison-image-base64"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(embeddingClient);
    }
}
