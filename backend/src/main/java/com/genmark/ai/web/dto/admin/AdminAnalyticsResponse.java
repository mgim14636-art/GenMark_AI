package com.genmark.ai.web.dto.admin;

import java.util.List;

/**
 * 관리자 대시보드의 기간별 실데이터 집계 응답.
 *
 * <p>금액·환불·주문 데이터는 서비스 범위에 없으므로 포함하지 않는다. 크레딧은
 * {@code credit_histories}의 증감 이력만 제공한다.
 */
public record AdminAnalyticsResponse(
        String period,
        String from,
        String to,
        Overview overview,
        Signup signup,
        Generation generation,
        Downloads downloads,
        Credits credits,
        Survey survey
) {
    public record Overview(
            long totalMembers,
            long newMembers,
            long totalGenerations,
            long ciGenerations,
            long biGenerations,
            long totalDownloads,
            long ciDownloads,
            long biDownloads
    ) {}

    public record Signup(
            long totalMembers,
            long newMembers,
            long startedGenerationMembers,
            List<AdminMetricPoint> providerCounts,
            List<AdminMetricPoint> onboardingUsage,
            List<AdminMetricPoint> onboardingAudience,
            List<AdminTrendPoint> trend,
            List<AdminMetricPoint> funnel
    ) {}

    public record Generation(
            long total,
            long ci,
            long bi,
            long succeeded,
            long failed,
            long likes,
            long dislikes,
            int satisfactionPercent,
            int trademarkUsagePercent,
            List<AdminMetricPoint> purpose,
            List<AdminMetricPoint> ciInputs,
            List<AdminMetricPoint> biInputs,
            List<AdminTrendPoint> trend
    ) {}

    public record Downloads(
            long total,
            long ci,
            long bi,
            List<AdminMetricPoint> ciStyles,
            List<AdminMetricPoint> biStyles,
            List<AdminTrendPoint> trend
    ) {}

    public record Credits(
            long used,
            long granted,
            long generateUsed,
            long downloadUsed,
            long surveyGranted,
            long signupGranted,
            long totalBalance
    ) {}

    public record Survey(
            long responses,
            long likes,
            long dislikes,
            List<AdminMetricPoint> improvements
    ) {}
}
