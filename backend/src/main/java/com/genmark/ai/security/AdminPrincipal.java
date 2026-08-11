package com.genmark.ai.security;

/**
 * 관리자 토큰으로 인증된 요청의 SecurityContext에 담기는 주체.
 *
 * <p>일반 회원용 {@link MemberPrincipal}과 타입 자체를 분리했다. 컨트롤러에서
 * {@code @AuthenticationPrincipal AdminPrincipal}로 받으면 회원 토큰으로는 절대 들어올 수 없다.
 */
public record AdminPrincipal(Long id, String loginId) {
}
