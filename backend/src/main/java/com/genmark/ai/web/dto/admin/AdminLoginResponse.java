package com.genmark.ai.web.dto.admin;

/** 관리자 로그인 성공 응답. 리프레시 토큰은 발급하지 않는다(만료되면 다시 로그인). */
public record AdminLoginResponse(
        String accessToken,
        long expiresIn,
        String loginId,
        String name
) {}
