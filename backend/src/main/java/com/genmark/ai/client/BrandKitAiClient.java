package com.genmark.ai.client;

import java.util.List;
import java.util.Map;

/**
 * 브랜드킷 이미지 생성을 AI 서버에 요청한다.
 *
 * <p>AI 서버의 {@code /api/v1/generation/brand-kit} 응답을 백엔드 저장 모델로 전달한다.
 */
public interface BrandKitAiClient {

    /**
     * @param request 로고 이미지와 킷 종류(명함/제품 썸네일), 컨셉 정보를 담은 요청
     * @return 생성 이미지와 임시 결과 여부/경고
     */
    Result generate(Map<String, Object> request);

    record PrintAsset(String svgBase64, String pdfBase64) {}

    record Result(List<String> imageBase64Values, List<PrintAsset> printAssets,
                  boolean preliminary, List<String> warnings) {
        public Result(List<String> imageBase64Values, boolean preliminary, List<String> warnings) {
            this(imageBase64Values, List.of(), preliminary, warnings);
        }

        public Result {
            imageBase64Values = imageBase64Values == null ? List.of() : List.copyOf(imageBase64Values);
            printAssets = printAssets == null ? List.of() : List.copyOf(printAssets);
            warnings = warnings == null ? List.of() : List.copyOf(warnings);
        }
    }
}
