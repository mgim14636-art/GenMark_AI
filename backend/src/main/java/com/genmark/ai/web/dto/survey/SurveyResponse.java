package com.genmark.ai.web.dto.survey;

/**
 * 설문조사 상태.
 *
 * @param completed     이미 응답했는지 여부. true면 다시 제출할 수 없다
 * @param creditBalance 응답 후(또는 현재) 남은 크레딧
 */
public record SurveyResponse(boolean completed, int creditBalance) {}
