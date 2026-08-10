package com.genmark.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.web.dto.logo.LogoCandidateResponse;
import com.genmark.ai.web.dto.logo.LogoGenerationResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LogoGenerationService {
    private final ProjectLookupService projectLookup;
    private final CiProjectRepository ciProjectRepository;
    private final BiProjectRepository biProjectRepository;
    private final LogoGenerationRepository generationRepository;
    private final LogoCandidateRepository candidateRepository;
    private final LogoGenerationWorker worker;
    private final ObjectMapper objectMapper;

    @Transactional
    public LogoGenerationResponse create(String projectPublicId, Long memberId, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Idempotency-Key 헤더가 필요합니다(최대 100자).");
        }
        ProjectLike project = projectLookup.requireOwned(projectPublicId, memberId);
        boolean isCi = project instanceof CiProject;

        LogoGeneration existing = (isCi
                ? generationRepository.findByCiProjectIdAndIdempotencyKey(project.getId(), idempotencyKey)
                : generationRepository.findByBiProjectIdAndIdempotencyKey(project.getId(), idempotencyKey))
                .orElse(null);
        if (existing != null) return toResponse(existing);
        if (project.getStatus() == ProjectStatus.GENERATING || project.getStatus() == ProjectStatus.ANALYZING) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "이미 진행 중인 작업이 있습니다.");
        }

        Map<String, Object> survey = project.toSurvey();

        // 재생성(F12-2): 직전 성공 생성이 있으면 그 후보 4개를 "이런 건 피해달라"로 함께 넘긴다.
        // 그래야 비슷하게 생긴 로고가 또 나오지 않는다.
        LogoGeneration previous = (isCi
                ? generationRepository.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(
                        project.getId(), LogoGeneration.Status.SUCCEEDED)
                : generationRepository.findFirstByBiProjectIdAndStatusOrderByCompletedAtDesc(
                        project.getId(), LogoGeneration.Status.SUCCEEDED))
                .orElse(null);
        if (previous != null) {
            survey.put("avoid_logos", avoidPayload(previous));
        }

        LogoGeneration generation = LogoGeneration.builder()
                .status(LogoGeneration.Status.QUEUED)
                .modelName("black-forest-labs/flux.2-klein-4b").requestSnapshotJson(writeJson(survey))
                .idempotencyKey(idempotencyKey)
                .parentGeneration(previous)
                .build();
        generation.setProject(project);
        generationRepository.save(generation);
        project.setStatus(ProjectStatus.GENERATING);
        saveProject(project);
        runAfterCommit(() -> worker.execute(generation.getId()));
        return toResponse(generation);
    }

    public LogoGenerationResponse get(String projectId, String generationId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        return toResponse(requireOwnedGeneration(project, generationId, memberId));
    }

    /**
     * Legacy project-scoped endpoint. Keep it safe for older clients by returning only the
     * latest successful generation instead of mixing candidates from every generation.
     */
    public List<LogoCandidateResponse> candidates(String projectId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;
        LogoGeneration generation = (isCi
                ? generationRepository.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(project.getId(), LogoGeneration.Status.SUCCEEDED)
                : generationRepository.findFirstByBiProjectIdAndStatusOrderByCompletedAtDesc(project.getId(), LogoGeneration.Status.SUCCEEDED))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        return candidatesFor(generation);
    }

    public List<LogoCandidateResponse> candidates(String projectId, String generationId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        LogoGeneration generation = requireOwnedGeneration(project, generationId, memberId);
        return candidatesFor(generation);
    }

    @Transactional
    public LogoCandidateResponse select(String projectId, String candidateId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;

        LogoCandidate selected = (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (selected.getGeneration().getStatus() != LogoGeneration.Status.SUCCEEDED) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "완료된 생성 작업의 후보만 선택할 수 있습니다.");
        }
        List<LogoCandidate> previouslySelected = isCi
                ? candidateRepository.findByGenerationCiProjectIdAndSelectedTrue(project.getId())
                : candidateRepository.findByGenerationBiProjectIdAndSelectedTrue(project.getId());
        previouslySelected.forEach(candidate -> candidate.setSelected(false));
        selected.setSelected(true);
        project.setStatus(ProjectStatus.RESULT_READY);
        saveProject(project);
        return toResponse(selected);
    }

    /**
     * 재생성 시 AI에게 넘길 "피해야 할 로고" 정보 (F12-2).
     *
     * <p>이전 생성의 후보 4개를 storageKey와 AI 부가정보(aiMetadataJson)로 전달한다.
     * 실제로 어떤 형식을 쓸지는 AI 서버와 합의가 필요하다. 이미지 자체를 넘길지, 프롬프트
     * 텍스트로 넘길지에 따라 이 부분이 바뀔 수 있다.
     */
    private List<Map<String, Object>> avoidPayload(LogoGeneration previous) {
        return candidateRepository.findByGenerationIdOrderByCandidateOrder(previous.getId()).stream()
                .map(c -> {
                    Map<String, Object> item = new LinkedHashMap<String, Object>();
                    item.put("candidate_id", c.getPublicId());
                    item.put("storage_key", c.getStorageKey());
                    if (c.getAiMetadataJson() != null) item.put("ai_metadata", c.getAiMetadataJson());
                    return item;
                })
                .toList();
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.INTERNAL_ERROR); }
    }

    private void saveProject(ProjectLike project) {
        if (project instanceof CiProject ci) ciProjectRepository.save(ci);
        else if (project instanceof BiProject bi) biProjectRepository.save(bi);
    }

    private LogoGeneration requireOwnedGeneration(ProjectLike project, String generationId, Long memberId) {
        var result = project instanceof CiProject
                ? generationRepository.findByPublicIdAndCiProjectIdAndCiProjectMemberId(generationId, project.getId(), memberId)
                : generationRepository.findByPublicIdAndBiProjectIdAndBiProjectMemberId(generationId, project.getId(), memberId);
        return result.orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    private List<LogoCandidateResponse> candidatesFor(LogoGeneration generation) {
        if (generation.getStatus() != LogoGeneration.Status.SUCCEEDED) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "완료된 생성 작업의 후보만 조회할 수 있습니다.");
        }
        List<LogoCandidate> candidates = candidateRepository
                .findByGenerationIdOrderByCandidateOrder(generation.getId());
        if (candidates.size() != 4) {
            throw new ApiException(ErrorCode.AI_INCOMPLETE_RESULT);
        }
        return candidates.stream().map(this::toResponse).toList();
    }

    private void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { task.run(); }
            });
        } else {
            task.run();
        }
    }

    public LogoGenerationResponse toResponse(LogoGeneration g) {
        return new LogoGenerationResponse(g.getPublicId(), g.getProject().getPublicId(), g.getStatus(),
                g.getModelName(), g.getErrorCode(), g.getErrorMessage(),
                g.getStartedAt(), g.getCompletedAt(), g.getCreatedAt());
    }

    private LogoCandidateResponse toResponse(LogoCandidate c) {
        return new LogoCandidateResponse(c.getPublicId(), c.getCandidateOrder(), c.getStorageKey(), c.getMimeType(),
                c.getWidth(), c.getHeight(), c.isSelected(), c.getPinnedAt(), c.getCreatedAt());
    }
}
