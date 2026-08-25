package com.genmark.ai.client;

import com.genmark.ai.web.dto.admin.AdminSimilarityCompareResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class FastApiEmbeddingAiClient implements EmbeddingAiClient {
    private final RestClient restClient;

    public FastApiEmbeddingAiClient(@Qualifier("aiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public void register(String imageBase64, String id) {
        Map<String, Object> body = restClient.post().uri("/api/v1/generation-vectors/register")
                .body(Map.of("image_url", imageBase64, "id", id))
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, this::rejectAsInvalidImage)
                .body(Map.class);
        if (body == null || body.get("totalCount") == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
    }

    @Override
    @SuppressWarnings("unchecked")
    public AdminSimilarityCompareResponse compareById(String id, String vectorImageBase64, String comparisonImageBase64) {
        Map<String, Object> body = restClient.post().uri("/api/v1/generation-vectors/compare")
                .body(Map.of("id", id, "vector_image_url", vectorImageBase64, "image_url", comparisonImageBase64))
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, this::rejectAsInvalidImage)
                .body(Map.class);
        if (body == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        try {
            int similarity = number(body.get("similarity"));
            String riskLevel = String.valueOf(body.get("riskLevel"));
            String disclaimer = String.valueOf(body.get("disclaimer"));
            String note = body.get("note") != null ? String.valueOf(body.get("note")) : null;
            if (similarity < 0 || similarity > 100 || disclaimer.isBlank()) {
                throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
            }
            return new AdminSimilarityCompareResponse(similarity, riskLevel, disclaimer, note);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        }
    }

    /**
     * AI 서버는 디코딩 못 하는 이미지(지원하지 않는 형식, 빈 파일 등)를 400으로 거절한다.
     * 이건 우리 쪽 버그가 아니라 사용자가 고른 파일이 문제인 경우라 500이 아니라
     * 명확한 안내 메시지로 바꿔서 올려보낸다.
     */
    private void rejectAsInvalidImage(org.springframework.http.HttpRequest request,
                                       org.springframework.http.client.ClientHttpResponse response) throws IOException {
        String detail = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
        throw new ApiException(ErrorCode.VALIDATION_ERROR,
                "이미지를 처리할 수 없어요. 다른 이미지 파일로 다시 시도해주세요. (" + summarize(detail) + ")");
    }

    private String summarize(String responseBody) {
        if (responseBody.contains("SIMILARITY_UNSUPPORTED_IMAGE")) return "지원하지 않는 이미지 형식";
        if (responseBody.contains("SIMILARITY_INVALID_BASE64")) return "이미지 데이터를 읽을 수 없음";
        return "이미지 처리 실패";
    }

    private int number(Object value) {
        if (!(value instanceof Number number)) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        return number.intValue();
    }
}
