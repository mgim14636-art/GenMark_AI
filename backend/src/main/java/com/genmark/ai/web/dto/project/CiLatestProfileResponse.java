package com.genmark.ai.web.dto.project;

/**
 * 두 번째 CI부터 자동으로 채워줄 회사 정보 (F7-1).
 *
 * @param hasPrevious 이전에 만든 CI가 있는지. false면 첫 CI라 화면을 빈 상태로 시작한다
 * @param companyName 직전 CI의 회사명 (필수 입력 항목)
 * @param coreValues  직전 CI의 핵심가치. 사용자가 비워뒀다면 null이다
 */
public record CiLatestProfileResponse(
        boolean hasPrevious,
        String companyName,
        String coreValues
) {
    public static CiLatestProfileResponse empty() {
        return new CiLatestProfileResponse(false, null, null);
    }
}
