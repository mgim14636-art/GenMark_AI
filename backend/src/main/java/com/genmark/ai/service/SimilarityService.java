package com.genmark.ai.service;

import com.genmark.ai.entity.GeneratedLogo;
import com.genmark.ai.entity.SimilarityResult;
import com.genmark.ai.repository.SimilarityResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SimilarityService {

    private final SimilarityResultRepository similarityResultRepository;
    private final AiServerService aiServerService;

    @Transactional
    public List<SimilarityResult> inspectSimilarity(GeneratedLogo logo) {
        List<Map<String, Object>> matches = aiServerService.requestSimilarityCheck(logo.getImageUrl());

        List<SimilarityResult> results = matches.stream().map(match -> {
            String trademarkId = (String) match.getOrDefault("trademark_id", "TM-UNKNOWN");
            String name = (String) match.getOrDefault("trademark_name", "Unknown Trademark");
            Double scoreDouble = ((Number) match.getOrDefault("similarity_score", 0.0)).doubleValue();

            return SimilarityResult.builder()
                    .logo(logo)
                    .matchedTrademarkId(trademarkId)
                    .matchedTrademarkName(name)
                    .similarityScore(scoreDouble.floatValue())
                    .build();
        }).toList();

        return similarityResultRepository.saveAll(results);
    }

    public List<SimilarityResult> getResultsByLogo(Long logoId) {
        return similarityResultRepository.findByLogoId(logoId);
    }
}
