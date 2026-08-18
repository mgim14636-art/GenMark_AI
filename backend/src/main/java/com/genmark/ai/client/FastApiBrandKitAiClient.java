package com.genmark.ai.client;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * 브랜드킷 생성을 AI 서버에 요청한다.
 *
 * <p>경로는 {@code app.ai.brand-kit-path}로 바꿀 수 있다. 구버전 AI 응답과의 호환을 위해
 * {@code preliminary}/{@code warnings}가 없으면 각각 false/빈 배열로 취급한다.
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
    public Result generate(Map<String, Object> request) {
        Map<String, Object> body = restClient.post().uri(path)
                .body(request).retrieve().body(Map.class);
        if (body == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "브랜드킷 응답이 비어 있습니다.");

        Object images = body.get("images");
        if (images instanceof List<?> items) {
            List<String> values = items.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(item -> item.get("imageBase64"))
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .filter(value -> !value.isBlank())
                    .toList();
            if (!values.isEmpty()) return result(body, values, printAssets(items));
        }

        Object image = body.get("imageBase64");
        if (!(image instanceof String value) || value.isBlank()) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "브랜드킷 응답에 imageBase64가 없습니다.");
        }
        return result(body, List.of(value), List.of());
    }

    private List<PrintAsset> printAssets(List<?> items) {
        return items.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(item -> new PrintAsset(string(item.get("svgBase64")), string(item.get("pdfBase64"))))
                .toList();
    }

    private String string(Object value) {
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private Result result(Map<String, Object> body, List<String> images, List<PrintAsset> printAssets) {
        boolean preliminary = Boolean.TRUE.equals(body.get("preliminary"));
        List<String> warnings = body.get("warnings") instanceof List<?> items
                ? items.stream().filter(String.class::isInstance).map(String.class::cast)
                        .filter(value -> !value.isBlank()).toList()
                : List.of();
        return new Result(images, printAssets, preliminary, warnings);
    }
}
