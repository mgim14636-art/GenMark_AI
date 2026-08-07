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

    public String generateAccessToken(Long memberId, String email, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("email", email)
                .claim("role", role)
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
