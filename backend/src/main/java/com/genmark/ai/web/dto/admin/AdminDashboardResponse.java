package com.genmark.ai.web.dto.admin;

/**
 * 관리자 대시보드 요약 (F16-1).
 *
 * @param totalMembers    전체 가입자 수
 * @param newMembers7Days 최근 7일 신규 가입자 수
 * @param totalGenerations 로고 생성 건수. 로고 4개 한 묶음이 1건이다
 * @param totalDownloads  다운로드 횟수. 로고 1개당 1회이며 같은 로고 재다운로드는 세지 않는다
 */
public record AdminDashboardResponse(
        long totalMembers,
        long newMembers7Days,
        long totalGenerations,
        long totalDownloads
) {}
