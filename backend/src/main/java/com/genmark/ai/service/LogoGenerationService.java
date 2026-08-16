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
        validateTextLogoName(project);
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

        // 재생성(F12-2): 직전 성공 생성이 있으면 이번이 몇 번째 재생성인지 세어
        // variant_offset으로 넘긴다. AI 서버가 그만큼 모티프 순환을 건너뛰어 직전
        // 회차와 겹치지 않는 시안을 배정해준다(AI 쪽에서 부정 프롬프트 방식은 채택하지 않음).
        LogoGeneration previous = (isCi
                ? generationRepository.findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(
                        project.getId(), LogoGeneration.Status.SUCCEEDED)
                : generationRepository.findFirstByBiProjectIdAndStatusOrderByCompletedAtDesc(
                        project.getId(), LogoGeneration.Status.SUCCEEDED))
                .orElse(null);
        if (previous != null) {
            survey.put("variant_offset", regenerationOffset(previous));
        }

        LogoGeneration generation = LogoGeneration.builder()
                .status(LogoGeneration.Status.QUEUED)
                .modelName(null).requestSnapshotJson(writeJson(survey))
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

    /** 재생성 시 한 번에 만드는 시안 수. AI 서버의 모티프 순환 배정 주기와 같아야 한다. */
    private static final int NUM_VARIANTS = 1;

    /**
     * 재생성 시 AI에게 넘길 모티프 시작 위치 (F12-2).
     *
     * <p>이전 생성까지 이어진 부모 체인 길이(=지금까지의 재생성 횟수) × 시안 수를 넘기면,
     * AI 서버가 그만큼 모티프 순환을 건너뛰어 직전 회차와 다른 형태를 배정한다. 이전에는
     * 이전 후보의 storageKey를 "피해야 할 로고"로 넘겼지만, AI 서버가 그 파일에 접근할
     * 수 없어 실제로는 무시되던 값이라 이 방식으로 대체했다.
     */
    private int regenerationOffset(LogoGeneration previous) {
        int count = 0;
        LogoGeneration cursor = previous;
        while (cursor != null) {
            count++;
            cursor = cursor.getParentGeneration();
        }
        return count * NUM_VARIANTS;
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
        if (candidates.size() != NUM_VARIANTS) {
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
        return new LogoCandidateResponse(c.getPublicId(), c.getCandidateOrder(), c.getStorageKey(), svgUrl(c), svgEdited(c), c.getMimeType(),
                c.getWidth(), c.getHeight(), c.isSelected(), c.getPinnedAt(), c.getCreatedAt());
    }

    private void validateTextLogoName(ProjectLike project) {
        String style;
        String name;
        if (project instanceof CiProject ci) {
            style = ci.getLogoStyle();
            name = ci.getCompanyName();
        } else if (project instanceof BiProject bi) {
            style = bi.getLogoStyle();
            name = bi.getBrandName();
        } else {
            return;
        }
        boolean textOnly = "wordmark".equalsIgnoreCase(style) || "lettermark".equalsIgnoreCase(style);
        if (textOnly && (name == null || name.isBlank())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "워드마크와 레터마크를 생성하려면 브랜드명 또는 기업명이 필요합니다.");
        }
    }

    private String svgUrl(LogoCandidate candidate) {
        if (candidate.getAiMetadataJson() == null) return null;
        try {
            Map<?, ?> metadata = objectMapper.readValue(candidate.getAiMetadataJson(), Map.class);
            if (!Boolean.TRUE.equals(metadata.get("svgAvailable"))) return null;
            return "/api/v1/projects/%s/logo-candidates/%s/svg".formatted(
                    candidate.getGeneration().getProject().getPublicId(), candidate.getPublicId());
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private boolean svgEdited(LogoCandidate candidate) {
        if (candidate.getAiMetadataJson() == null) return false;
        try {
            Map<?, ?> metadata = objectMapper.readValue(candidate.getAiMetadataJson(), Map.class);
            return Boolean.TRUE.equals(metadata.get("svgEdited"));
        } catch (JsonProcessingException e) {
            return false;
        }
    }
}
