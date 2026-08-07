package com.genmark.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Project;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.ProjectRepository;
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
    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final LogoGenerationRepository generationRepository;
    private final LogoCandidateRepository candidateRepository;
    private final LogoGenerationWorker worker;
    private final ObjectMapper objectMapper;

    @Transactional
    public LogoGenerationResponse create(String projectPublicId, Long memberId, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Idempotency-Key 헤더가 필요합니다(최대 100자).");
        }
        Project project = projectService.requireOwned(projectPublicId, memberId);
        LogoGeneration existing = generationRepository
                .findByProjectIdAndIdempotencyKey(project.getId(), idempotencyKey).orElse(null);
        if (existing != null) return toResponse(existing);
        if (project.getStatus() == Project.Status.GENERATING || project.getStatus() == Project.Status.ANALYZING) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "이미 진행 중인 작업이 있습니다.");
        }

        Map<String, Object> survey = toSurvey(project);
        LogoGeneration generation = LogoGeneration.builder()
                .project(project).status(LogoGeneration.Status.QUEUED).candidateCount(4)
                .modelName("logo-ai-server").requestSnapshotJson(writeJson(survey))
                .idempotencyKey(idempotencyKey).build();
        generationRepository.save(generation);
        project.setStatus(Project.Status.GENERATING);
        projectRepository.save(project);
        runAfterCommit(() -> worker.execute(generation.getId()));
        return toResponse(generation);
    }

    public LogoGenerationResponse get(String projectId, String generationId, Long memberId) {
        projectService.requireOwned(projectId, memberId);
        LogoGeneration generation = generationRepository.findByPublicIdAndProjectMemberId(generationId, memberId)
                .filter(g -> g.getProject().getPublicId().equals(projectId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        return toResponse(generation);
    }

    public List<LogoCandidateResponse> candidates(String projectId, Long memberId) {
        Project project = projectService.requireOwned(projectId, memberId);
        return candidateRepository
                .findByGenerationProjectIdAndGenerationProjectMemberIdOrderByCandidateOrder(project.getId(), memberId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public LogoCandidateResponse select(String projectId, String candidateId, Long memberId) {
        Project project = projectService.requireOwned(projectId, memberId);
        LogoCandidate selected = candidateRepository
                .findByPublicIdAndGenerationProjectIdAndGenerationProjectMemberId(candidateId, project.getId(), memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (selected.getGeneration().getStatus() != LogoGeneration.Status.SUCCEEDED) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "완료된 생성 작업의 후보만 선택할 수 있습니다.");
        }
        candidateRepository.findByGenerationProjectIdAndSelectedTrue(project.getId())
                .forEach(candidate -> candidate.setSelected(false));
        selected.setSelected(true);
        project.setStatus(Project.Status.RESULT_READY);
        return toResponse(selected);
    }

    public Map<String, Object> toSurvey(Project p) {
        Map<String, Object> survey = new LinkedHashMap<>();
        survey.put("brand_name", p.getBrandName()); survey.put("industry", p.getIndustry());
        survey.put("brand_values", projectService.readList(p.getBrandValuesJson()));
        survey.put("brand_values_text", p.getBrandValuesText()); survey.put("target_age", p.getTargetAge());
        survey.put("tone", p.getTone()); survey.put("color_mode", p.getColorMode());
        survey.put("color_manual", projectService.readList(p.getColorsJson())); survey.put("style", p.getLogoStyle());
        survey.put("include_brand_name_in_logo", p.isIncludeBrandName());
        survey.put("additional_requirements", p.getAdditionalRequirements());
        return survey;
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.INTERNAL_ERROR); }
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
                g.getCandidateCount(), g.getModelName(), g.getErrorCode(), g.getErrorMessage(),
                g.getStartedAt(), g.getCompletedAt(), g.getCreatedAt());
    }

    private LogoCandidateResponse toResponse(LogoCandidate c) {
        return new LogoCandidateResponse(c.getPublicId(), c.getCandidateOrder(), c.getStorageKey(), c.getMimeType(),
                c.getWidth(), c.getHeight(), c.isSelected(), c.isSaved(), c.getCreatedAt());
    }
}
