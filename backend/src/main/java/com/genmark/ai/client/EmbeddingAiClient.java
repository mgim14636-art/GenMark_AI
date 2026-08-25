package com.genmark.ai.client;

import com.genmark.ai.web.dto.admin.AdminSimilarityCompareResponse;

public interface EmbeddingAiClient {
    /**
     * 이미지(Base64)를 벡터로 만들어 AI 서버의 generation-data 저장소에 {@code id}로
     * 등록한다. 이미 등록된 id면 AI 서버가 그대로 두고 현재 건수를 돌려준다.
     */
    void register(String imageBase64, String id);

    /**
     * {@code id}로 저장된 벡터와 비교 이미지를 1:1로 비교한 결과를 돌려준다. 기록하지 않는다.
     *
     * @param vectorImageBase64 등록된 벡터 자체의 원본 이미지(Base64). 점수 계산에는 쓰이지
     *                          않고(점수는 저장된 벡터로 계산한다), 두 이미지가 왜 닮았는지
     *                          설명하는 note를 만들 때만 쓴다.
     */
    AdminSimilarityCompareResponse compareById(String id, String vectorImageBase64, String comparisonImageBase64);
}
