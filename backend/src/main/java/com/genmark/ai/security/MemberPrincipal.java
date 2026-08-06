package com.genmark.ai.security;

/** JWT 검증에 성공한 요청의 SecurityContext에 담기는 인증 주체. */
public record MemberPrincipal(Long id, String email, String role) {
}
