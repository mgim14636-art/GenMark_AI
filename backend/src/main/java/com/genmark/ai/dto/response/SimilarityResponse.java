package com.genmark.ai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimilarityResponse {
    private Long logoId;
    private List<MatchedItem> matches;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MatchedItem {
        private String trademarkId;
        private String trademarkName;
        private Float score;
    }
}
