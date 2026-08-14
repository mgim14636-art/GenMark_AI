package com.genmark.ai.service;

import com.genmark.ai.client.TrademarkAiClient;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TrademarkAnalysisProcessor {
    private static final Logger log = LoggerFactory.getLogger(TrademarkAnalysisProcessor.class);
    private static final int REQUESTED_MATCH_COUNT = 3;

    private final TrademarkAnalysisRepository analysisRepository;
    private final TrademarkMatchRepository matchRepository;
    private final TrademarkAiClient aiClient;
    private final LogoFileStorage storage;

    @Transactional
    public void process(Long analysisId) {
        TrademarkAnalysis analysis = analysisRepository.findById(analysisId).orElse(null);
        if (analysis == null || analysis.getStatus() != TrademarkAnalysis.Status.QUEUED) return;
        analysis.setStatus(TrademarkAnalysis.Status.RUNNING);
        analysis.setStartedAt(LocalDateTime.now());
        try {
            byte[] png = storage.read(analysis.getCandidate().getStorageKey());
            TrademarkAiClient.Result result = aiClient.search(Base64.getEncoder().encodeToString(png),
                    analysis.getProject().getLogoStyle(), REQUESTED_MATCH_COUNT);
            validate(result);
            if (result.matches().size() < REQUESTED_MATCH_COUNT) {
                log.warn("상표 분석 {}의 유사 상표 결과가 요청 개수보다 적습니다: {}/{}",
                        analysisId, result.matches().size(), REQUESTED_MATCH_COUNT);
            }
            analysis.setMaxSimilarity(result.maxSimilarity());
            analysis.setRiskLevel(result.riskLevel());
            analysis.setDisclaimer(result.disclaimer());
            for (int i = 0; i < result.matches().size(); i++) {
                TrademarkAiClient.Match match = result.matches().get(i);
                matchRepository.save(TrademarkMatch.builder().analysis(analysis).rank(i + 1)
                        .applicationNumber(match.applicationNumber()).name(match.name()).category(match.category())
                        .similarity(match.similarity()).imagePath(match.imagePath()).build());
            }
            analysis.setStatus(TrademarkAnalysis.Status.SUCCEEDED);
            analysis.getProject().setStatus(ProjectStatus.COMPLETED);
            analysis.setCompletedAt(LocalDateTime.now());
        } catch (Exception ex) {
            analysis.setStatus(TrademarkAnalysis.Status.FAILED);
            analysis.getProject().setStatus(ProjectStatus.RESULT_READY);
            analysis.setErrorCode(ex instanceof ApiException api ? api.getErrorCode().name() : ErrorCode.AI_UNAVAILABLE.name());
            analysis.setErrorMessage(safeMessage(ex));
            analysis.setCompletedAt(LocalDateTime.now());
        }
    }

    private void validate(TrademarkAiClient.Result result) {
        if (result == null || result.riskLevel() == null || result.disclaimer() == null
                || result.disclaimer().isBlank() || result.matches() == null || result.matches().isEmpty()
                || result.matches().size() > REQUESTED_MATCH_COUNT
                || result.maxSimilarity() < 0 || result.maxSimilarity() > 100) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        }
        boolean invalid = result.matches().stream().anyMatch(m -> m.similarity() < 0 || m.similarity() > 100);
        if (invalid) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
    }

    private String safeMessage(Exception ex) {
        String message = ex instanceof ApiException ? ex.getMessage() : "AI 서버 호출에 실패했습니다.";
        return message == null ? "AI 서버 호출에 실패했습니다." : message.substring(0, Math.min(message.length(), 1000));
    }
}
