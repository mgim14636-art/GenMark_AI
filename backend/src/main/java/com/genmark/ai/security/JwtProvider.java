package com.genmark.ai.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * GenMark AI 자체 발급 액세스 토큰(JWT)의 생성/검증을 담당한다.
 * 리프레시 토큰은 JWT가 아니라 opaque random 값이며 {@link TokenHasher}로 별도 관리한다.
 */
@Component
public class JwtProvider {

    private final SecretKey signingKey;
    private final long accessTokenExpirationSeconds;

    public JwtProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiration-seconds:3600}") long accessTokenExpirationSeconds
    ) {
        // HS256은 최소 256bit(32byte) 키가 필요하다. 운영 환경에서는 JWT_SECRET을
        // 충분히 긴 랜덤 값으로 반드시 교체해야 한다 (docs/AUTH_INTEGRATION.md 참고).
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationSeconds = accessTokenExpirationSeconds;
    }

    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationSeconds;
    }

    /**
     * 관리자 토큰임을 구분하는 클레임 이름. 이 값이 {@link #TOKEN_TYPE_ADMIN}이면 관리자 토큰이다.
     * 클레임이 없는 기존 토큰은 모두 회원 토큰으로 취급된다(하위 호환).
     */
    public static final String CLAIM_TOKEN_TYPE = "typ";
    public static final String TOKEN_TYPE_ADMIN = "admin";

    public String generateAccessToken(Long memberId, String email) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTokenExpirationSeconds)))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 관리자용 액세스 토큰. 회원 토큰과 서명 키는 같지만 {@code typ=admin} 클레임으로 구분한다.
     *
     * <p>클레임을 나누는 이유: 회원 토큰으로 관리자 API를 부르거나 그 반대가 되면 안 되기 때문이다.
     * 필터가 이 값을 보고 서로 다른 principal과 권한을 부여한다.
     */
    public String generateAdminAccessToken(Long adminId, String loginId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(adminId))
                .claim("loginId", loginId)
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ADMIN)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTokenExpirationSeconds)))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * @throws JwtException 서명이 유효하지 않거나 토큰이 만료된 경우
     */
    public Claims parseAndValidate(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
