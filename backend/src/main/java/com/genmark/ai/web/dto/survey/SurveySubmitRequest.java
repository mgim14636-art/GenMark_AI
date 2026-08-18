package com.genmark.ai.web.dto.survey;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SurveySubmitRequest(
        @NotNull Integer rating,
        @Size(max = 6) List<@Pattern(regexp = "로고 생성·재생성|브랜드 맞춤 로고|로고 수정|유사 상표 확인|로고 저장·활용|기타") String> improvements,
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
