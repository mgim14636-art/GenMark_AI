package com.genmark.ai.web.dto.survey;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SurveySubmitRequest(
        @NotNull Integer rating,
        @Size(max = 6) List<@Pattern(regexp = "로고 생성 시간이 오래 걸려서 불편함|원하는 느낌/스타일의 로고가 잘 안 나옴|로고 수정이 어렵거나 마음대로 안 됨|브랜드 키트·명함 만들기 기능이 아쉬움|유사 상표 확인 결과를 얼마나 믿어야 할지 모르겠음|기타 사항") String> improvements,
        @Size(max = 500) String comment
) {
    public SurveySubmitRequest {
        improvements = improvements == null ? List.of() : List.copyOf(improvements);
    }

    @AssertTrue(message = "rating은 1 또는 5여야 합니다.")
    public boolean isSupportedRating() {
        return rating == null || rating == 1 || rating == 5;
    }
}
