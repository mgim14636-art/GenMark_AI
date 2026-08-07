package com.genmark.ai.service;

import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.Project;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.ProjectRepository;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import com.genmark.ai.web.dto.trademark.TrademarkAnalysisResponse;
import com.genmark.ai.web.dto.trademark.TrademarkMatchResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TrademarkAnalysisService {
    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final LogoCandidateRepository candidateRepository;
    private final TrademarkAnalysisRepository analysisRepository;
    private final TrademarkMatchRepository matchRepository;
    private final TrademarkAnalysisWorker worker;

    @Transactional
    public TrademarkAnalysisResponse create(String projectPublicId, Long memberId) {
        Project project = projectService.requireOwned(projectPublicId, memberId);
        LogoCandidate candidate = candidateRepository.findFirstByGenerationProjectIdAndSelectedTrue(project.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_CONFLICT, "먼저 최종 로고 후보를 선택해 주세요."));
        if (project.getStatus() == Project.Status.ANALYZING) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "이미 상표 분석이 진행 중입니다.");
        }
        TrademarkAnalysis analysis = analysisRepository.save(TrademarkAnalysis.builder()
                .project(project).candidate(candidate).status(TrademarkAnalysis.Status.QUEUED).build());
        project.setStatus(Project.Status.ANALYZING);
        projectRepository.save(project);
        runAfterCommit(() -> worker.execute(analysis.getId()));
        return toResponse(analysis);
    }

    public TrademarkAnalysisResponse get(String projectId, String analysisId, Long memberId) {
        projectService.requireOwned(projectId, memberId);
        TrademarkAnalysis analysis = requireOwned(analysisId, memberId);
        if (!analysis.getProject().getPublicId().equals(projectId)) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        return toResponse(analysis);
    }

    public List<TrademarkMatchResponse> matches(String projectId, String analysisId, Long memberId) {
        projectService.requireOwned(projectId, memberId);
        TrademarkAnalysis analysis = requireOwned(analysisId, memberId);
        if (!analysis.getProject().getPublicId().equals(projectId)) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        return matchRepository.findByAnalysisIdOrderByRank(analysis.getId()).stream()
                .map(this::toResponse).toList();
    }

    private TrademarkAnalysis requireOwned(String analysisId, Long memberId) {
        return analysisRepository.findByPublicIdAndProjectMemberId(analysisId, memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    public TrademarkAnalysisResponse toResponse(TrademarkAnalysis a) {
        String label = null;
        String description = null;
        if (a.getRiskLevel() != null) {
            label = switch (a.getRiskLevel()) {
                case SAFE -> "안전"; case MODERATE -> "보통"; case CAUTION -> "주의";
            };
            description = switch (a.getRiskLevel()) {
                case SAFE -> "시각적으로 유사한 등록 상표가 적습니다.";
                case MODERATE -> "일부 유사 요소가 있어 검토가 필요합니다.";
                case CAUTION -> "유사도가 높아 전문가 검토를 권장합니다.";
            };
        }
        return new TrademarkAnalysisResponse(a.getPublicId(), a.getProject().getPublicId(),
                a.getCandidate().getPublicId(), a.getStatus(), a.getMaxSimilarity(), a.getRiskLevel(), label,
                description, a.getDisclaimer(), a.getErrorCode(), a.getErrorMessage(), a.getStartedAt(),
                a.getCompletedAt(), a.getCreatedAt());
    }

    private TrademarkMatchResponse toResponse(TrademarkMatch m) {
        return new TrademarkMatchResponse(m.getRank(), m.getApplicationNumber(), m.getName(), m.getCategory(),
                m.getSimilarity(), m.getImagePath());
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
}
