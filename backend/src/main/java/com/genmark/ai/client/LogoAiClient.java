package com.genmark.ai.client;

import java.util.List;
import java.util.Map;

public interface LogoAiClient {
    LogoAiResult generate(Map<String, Object> survey);

    /**
     * AI가 로고 한 장과 함께 돌려주는 부가 정보.
     *
     * <p>{@code seed}/{@code variantIndex}는 재생성(F12-2) 시 이전과 겹치지 않는 시안을
     * 배정받기 위해 {@code logo_candidates.ai_metadata_json}에 저장해둔다. AI가 값을
     * 안 주면 null일 수 있다.
     */
    record GeneratedLogo(String imageBase64, Integer seed, Integer variantIndex, String svg) {}

    record LogoAiResult(boolean success, List<GeneratedLogo> logos) {}
}
