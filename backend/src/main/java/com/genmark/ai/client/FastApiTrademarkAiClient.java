package com.genmark.ai.client;

import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class FastApiTrademarkAiClient implements TrademarkAiClient {
    private final RestClient restClient;

    public FastApiTrademarkAiClient(@Qualifier("aiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    @SuppressWarnings("unchecked")
    public Result search(String imageBase64, String logoStyle, int topK) {
        Map<String, Object> body = restClient.post().uri("/api/v1/similarity/search")
                .body(Map.of("imageBase64", imageBase64, "logoStyle", logoStyle, "topK", topK))
                .retrieve().body(Map.class);
        if (body == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        try {
            int max = number(body.get("maxSimilarity"));
            TrademarkAnalysis.RiskLevel risk = TrademarkAnalysis.RiskLevel.valueOf(String.valueOf(body.get("riskLevel")));
            String disclaimer = string(body.get("disclaimer"));
            Object raw = body.get("matches");
            if (!(raw instanceof List<?> list)) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
            List<Match> matches = list.stream().map(item -> toMatch((Map<String, Object>) item)).toList();
            validateScore(max);
            if (disclaimer == null || disclaimer.isBlank() || matches.isEmpty() || matches.size() > topK) {
                throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
            }
            return new Result(max, risk, matches, disclaimer);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        }
    }

    private Match toMatch(Map<String, Object> value) {
        int similarity = number(value.get("similarity"));
        validateScore(similarity);
        return new Match(string(value.get("applicationNumber")), string(value.get("name")),
                string(value.get("category")), similarity, string(value.get("imagePath")), string(value.get("note")));
    }

    private int number(Object value) {
        if (!(value instanceof Number number)) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        return number.intValue();
    }

    private String string(Object value) { return value == null ? null : String.valueOf(value); }

    private void validateScore(int value) {
        if (value < 0 || value > 100) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
    }
}
