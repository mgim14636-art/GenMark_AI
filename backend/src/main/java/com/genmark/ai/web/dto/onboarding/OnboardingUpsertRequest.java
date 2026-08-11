package com.genmark.ai.web.dto.onboarding;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 온보딩 제출 요청. 처음 로그인한 사용자에게 한 번만 받는다.
 *
 * <p>예전에는 여기에 초기 CI/BI 프로젝트 정보(detailsDecision, initialCiProject,
 * initialBiProject)까지 함께 받았지만, 지금은 "온보딩 → 업종 선택 → CI/BI 선택 → 입력"
 * 순서로 흐름이 바뀌어 프로젝트는 온보딩이 끝난 뒤 별도 화면에서 만든다. 그래서 제거했다.
 *
 * <p>프론트엔드가 아직 {@code detailsDecision}을 보내더라도 문제없다.
 * 스프링 부트는 모르는 필드를 무시하도록 설정돼 있다.
 */
public record OnboardingUpsertRequest(
        @NotEmpty List<@NotBlank @Size(max = 100) String> usage,
        @NotBlank @Size(max = 100) String audience
) {}
