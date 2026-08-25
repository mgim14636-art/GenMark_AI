package com.genmark.ai.service;

import com.genmark.ai.client.EmbeddingAiClient;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.GeneratedLogoVector;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.GeneratedLogoVectorRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.admin.AdminSimilarityCompareResponse;
import com.genmark.ai.web.dto.admin.AdminSimilarityVectorRow;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;

/**
 * 관리자 전용 "유사도 관리 및 테스트" 도구.
 *
 * <p>실제 임베딩 벡터와 점수 계산은 전부 AI 서버가 맡는다(generation-data 볼륨에
 * KIPRIS와 같은 embeddings.npy + ids.csv 형식으로 저장하고, 비교 점수도 AI
 * 서버의 similarity_service 계산식을 그대로 재사용한다). 여기서는 "어떤 후보를
 * 벡터화했는지"만 백엔드 DB에 기록해 목록 화면과 중복 방지에 쓴다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminSimilarityService {
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    private final LogoCandidateRepository candidateRepository;
    private final GeneratedLogoVectorRepository vectorRepository;
    private final EmbeddingAiClient embeddingClient;
    private final LogoFileStorage storage;

    @Transactional
    public AdminSimilarityVectorRow vectorize(String candidatePublicId) {
        LogoCandidate candidate = candidateRepository.findByPublicId(candidatePublicId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        GeneratedLogoVector existing = vectorRepository.findByCandidateId(candidate.getId()).orElse(null);
        if (existing != null) return toRow(existing);

        byte[] png = storage.read(candidate.getStorageKey());
        embeddingClient.register(Base64.getEncoder().encodeToString(png), candidate.getPublicId());

        GeneratedLogoVector saved = vectorRepository.save(GeneratedLogoVector.builder()
                .candidate(candidate)
                .build());
        return toRow(saved);
    }

    public List<AdminSimilarityVectorRow> list() {
        return vectorRepository.findAllByOrderByVectorizedAtDesc().stream().map(this::toRow).toList();
    }

    public AdminSimilarityCompareResponse compare(Long vectorId, String comparisonImageBase64) {
        GeneratedLogoVector stored = vectorRepository.findById(vectorId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        LogoCandidate candidate = stored.getCandidate();
        byte[] png = storage.read(candidate.getStorageKey());
        String vectorImageBase64 = Base64.getEncoder().encodeToString(png);
        return embeddingClient.compareById(candidate.getPublicId(), vectorImageBase64, comparisonImageBase64);
    }

    private AdminSimilarityVectorRow toRow(GeneratedLogoVector saved) {
        LogoCandidate candidate = saved.getCandidate();
        ProjectLike project = candidate.getGeneration().getProject();
        boolean isCi = project instanceof CiProject;
        String name = isCi ? ((CiProject) project).getCompanyName() : ((BiProject) project).getBrandName();
        if (name == null || name.isBlank()) name = "이름 없는 프로젝트";
        return new AdminSimilarityVectorRow(
                saved.getId(),
                candidate.getPublicId(),
                project.getPublicId(),
                isCi ? "CI" : "BI",
                name,
                "/api/v1/admin/candidates/" + candidate.getPublicId() + "/image",
                DATE_FORMAT.format(saved.getVectorizedAt()));
    }
}
