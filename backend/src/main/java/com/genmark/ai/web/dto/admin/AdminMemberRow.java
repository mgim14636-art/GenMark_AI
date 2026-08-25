package com.genmark.ai.web.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 회원관리 목록의 한 줄 (F16-2).
 *
 * @param email                   화면의 "아이디" 칸. 회원에게 비밀번호가 없어 이메일이 식별자 역할을 한다.
 *                                카카오에서 이메일 동의를 받지 못한 계정은
 *                                {@code kakao+{providerId}@oauth.genmark.local} 형태의 합성 주소가 들어 있다
 * @param provider                google | kakao. 위 합성 이메일을 구분해 표시하려면 이 값을 함께 본다
 * @param ciGenerations           CI 로고 생성 건수 (4개 묶음 = 1건)
 * @param biGenerations           BI 로고 생성 건수 (4개 묶음 = 1건)
 * @param downloadCount           다운로드 횟수 (로고 1개당 1회)
 * @param creditBalance           남은 크레딧
 * @param paidUser                유료 사용자 여부. 결제 기능이 아직 없어 항상 false다 (미확정 항목)
 * @param onboardingCompleted     온보딩(첫 방문 설문) 작성 여부. member_onboardings에 행이 있으면 true
 * @param onboardingUsage         온보딩 1단계에서 고른 사용처(online/social/offline). 복수 선택 가능,
 *                                미작성이면 빈 리스트
 * @param onboardingAudience      온보딩 2단계에서 고른 방문 계기(company/owner/hobby/sidejob). 미작성이면 null
 * @param onboardingCompletedAt   온보딩 작성 시각. 미작성이면 null
 */
public record AdminMemberRow(
        Long id,
        String email,
        String name,
        String provider,
        long ciGenerations,
        long biGenerations,
        long downloadCount,
        int creditBalance,
        boolean paidUser,
        LocalDateTime createdAt,
        boolean onboardingCompleted,
        List<String> onboardingUsage,
        String onboardingAudience,
        LocalDateTime onboardingCompletedAt
) {}
