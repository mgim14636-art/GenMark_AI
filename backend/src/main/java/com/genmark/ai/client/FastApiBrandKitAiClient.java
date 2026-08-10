package com.genmark.ai.client;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * 브랜드킷 생성을 AI 서버에 요청한다.
 *
 * <p><b>이 엔드포인트는 AI 서버에 아직 없다.</b> 경로는 설정으로 뺐으니
 * AI 담당자와 규격이 합의되면 {@code app.ai.brand-kit-path} 값만 바꾸면 된다.
 * 응답 키({@code imageBase64})도 합의에 따라 달라질 수 있다.
 *
 * <p>엔드포인트가 없는 동안에는 호출이 실패하고 brand_kits.status가 FAILED로 남으며,
 * error_code/error_message에 이유가 기록된다.
 */
@Component
public class FastApiBrandKitAiClient implements BrandKitAiClient {

    private final RestClient restClient;
    private final String path;

    public FastApiBrandKitAiClient(@Qualifier("aiRestClient") RestClient restClient,
                                   @Value("${app.ai.brand-kit-path:/api/v1/generation/brand-kit}") String path) {
        this.restClient = restClient;
        this.path = path;
    }

    @Override
    @SuppressWarnings("unchecked")
    public String generate(Map<String, Object> request) {
        Map<String, Object> body = restClient.post().uri(path)
                .body(request).retrieve().body(Map.class);
        if (body == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "브랜드킷 응답이 비어 있습니다.");

        Object image = body.get("imageBase64");
        if (!(image instanceof String value) || value.isBlank()) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "브랜드킷 응답에 imageBase64가 없습니다.");
        }
        return value;
    }
}
