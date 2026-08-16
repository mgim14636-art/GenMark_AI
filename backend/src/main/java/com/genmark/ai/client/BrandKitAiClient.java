package com.genmark.ai.client;

import java.util.List;
import java.util.Map;

/**
 * 브랜드킷 이미지 생성을 AI 서버에 요청한다.
 *
 * <p><b>주의: AI 서버에 아직 이 엔드포인트가 없다.</b> 현재 AI 서버에는
 * {@code /health}, {@code /generate}, {@code /search}, {@code /extract} 네 개뿐이다.
 * 요청/응답 형식은 AI 담당자와 합의한 뒤 확정해야 하며, 그전까지 이 인터페이스를 쓰는
 * 기능은 동작하지 않는다(AI_UNAVAILABLE로 실패 처리된다).
 */
public interface BrandKitAiClient {

    /**
     * @param request 로고 이미지와 킷 종류(명함/제품 썸네일), 컨셉 정보를 담은 요청
     * @return 생성된 이미지의 Base64 PNG 문자열
     */
    List<String> generate(Map<String, Object> request);
}
