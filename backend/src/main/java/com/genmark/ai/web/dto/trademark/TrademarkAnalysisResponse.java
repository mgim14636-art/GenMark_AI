package com.genmark.ai.web.dto.trademark;

import com.genmark.ai.entity.TrademarkAnalysis;

import java.time.LocalDateTime;

public record TrademarkAnalysisResponse(
        String id,
        String projectId,
        String candidateId,
        TrademarkAnalysis.Status status,
        Integer maxSimilarity,
        TrademarkAnalysis.RiskLevel riskLevel,
        String riskLabel,
        String riskDescription,
        String disclaimer,
        String errorCode,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime createdAt
) {}
