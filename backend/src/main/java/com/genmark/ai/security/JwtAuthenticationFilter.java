package com.genmark.ai.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authorization: Bearer {accessToken} 헤더를 읽어 SecurityContext에 인증 정보를 채운다.
 * 토큰이 없으면 그냥 통과시키고(익명), 이후 authorizeHttpRequests 규칙이 401 여부를 결정한다.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** ApiAuthenticationEntryPoint가 AUTH_REQUIRED와 TOKEN_EXPIRED를 구분하는 데 쓰는 요청 속성. */
    public static final String AUTH_ERROR_ATTRIBUTE = "apiAuthError";

    private final JwtProvider jwtProvider;

    public JwtAuthenticationFilter(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = jwtProvider.parseAndValidate(token);
                String tokenType = claims.get(JwtProvider.CLAIM_TOKEN_TYPE, String.class);

                UsernamePasswordAuthenticationToken authentication;
                if (JwtProvider.TOKEN_TYPE_ADMIN.equals(tokenType)) {
                    // 관리자 토큰: ROLE_ADMIN을 부여해 /api/v1/admin/** 접근을 허용한다.
                    AdminPrincipal principal = new AdminPrincipal(
                            Long.valueOf(claims.getSubject()), claims.get("loginId", String.class));
                    authentication = new UsernamePasswordAuthenticationToken(
                            principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                } else {
                    // 일반 회원 토큰: 권한 구분이 없어 authorities는 비어 있다.
                    // 빈 목록이어도 인증된 토큰으로 취급되므로 .authenticated() 규칙은 그대로 통과한다.
                    MemberPrincipal principal = new MemberPrincipal(
                            Long.valueOf(claims.getSubject()), claims.get("email", String.class));
                    authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
                }
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (ExpiredJwtException e) {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, "TOKEN_EXPIRED");
            } catch (JwtException | IllegalArgumentException e) {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, "AUTH_REQUIRED");
            }
        }

        filterChain.doFilter(request, response);
    }
}
