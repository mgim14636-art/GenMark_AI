package com.genmark.ai.client;

import com.genmark.ai.entity.TrademarkAnalysis;

import java.util.List;

public interface TrademarkAiClient {
    Result search(String imageBase64, String logoStyle, int topK);

    record Result(int maxSimilarity, TrademarkAnalysis.RiskLevel riskLevel,
                  List<Match> matches, String disclaimer) {}

    enum Source { KIPRIS, GENERATED }

    record Match(String applicationNumber, String name, String category,
                 int similarity, String imagePath, String note, Source source) {
        public Match(String applicationNumber, String name, String category, int similarity, String imagePath) {
            this(applicationNumber, name, category, similarity, imagePath, null, Source.KIPRIS);
        }

        public Match(String applicationNumber, String name, String category, int similarity, String imagePath, String note) {
            this(applicationNumber, name, category, similarity, imagePath, note, Source.KIPRIS);
        }
    }
}
