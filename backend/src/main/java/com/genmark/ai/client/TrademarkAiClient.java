package com.genmark.ai.client;

import com.genmark.ai.entity.TrademarkAnalysis;

import java.util.List;

public interface TrademarkAiClient {
    Result search(String imageBase64, String logoStyle, int topK);

    record Result(int maxSimilarity, TrademarkAnalysis.RiskLevel riskLevel,
                  List<Match> matches, String disclaimer) {}

    record Match(String applicationNumber, String name, String category,
                 int similarity, String imagePath, String note) {
        public Match(String applicationNumber, String name, String category, int similarity, String imagePath) {
            this(applicationNumber, name, category, similarity, imagePath, null);
        }
    }
}
