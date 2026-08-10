package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.oauth.OAuthUserInfo;
import com.genmark.ai.oauth.OAuthVerifier;
import com.genmark.ai.oauth.OAuthVerifierResolver;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.ProjectRepository;
import com.genmark.ai.security.JwtProvider;
import com.genmark.ai.security.TokenHasher;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * API_SPEC.md 5.1 인증 흐름의 구현체.
 * 프로젝트 진행상태(status) 필드가 아직 projects 테이블에 없어서 resumeProjectId는
 * 항상 null을 반환한다 (Phase 2에서 프로젝트 도메인이 구현되면 채워야 함).
 */
@Service
public class AuthService {

    private final MemberRepository memberRepository;
    private final OAuthVerifierResolver oAuthVerifierResolver;
    private final JwtProvider jwtProvider;
    private final MemberOnboardingRepository onboardingRepository;
    private final ProjectRepository projectRepository;
    private final long refreshTokenExpirationDays;

    public AuthService(
            MemberRepository memberRepository,
            OAuthVerifierResolver oAuthVerifierResolver,
            JwtProvider jwtProvider,
            MemberOnboardingRepository onboardingRepository,
            ProjectRepository projectRepository,
            @Value("${jwt.refresh-token-expiration-days:14}") long refreshTokenExpirationDays
    ) {
        this.memberRepository = memberRepository;
        this.oAuthVerifierResolver = oAuthVerifierResolver;
        this.jwtProvider = jwtProvider;
        this.onboardingRepository = onboardingRepository;
        this.projectRepository = projectRepository;
        this.refreshTokenExpirationDays = refreshTokenExpirationDays;
    }

    public record LoginResult(
            String accessToken,
            String refreshToken,
            long expiresIn,
            Member member,
            boolean isFirstLogin,
            boolean onboardingCompleted,
            String resumeProjectId
    ) {
    }

    public record RefreshResult(String accessToken, String refreshToken, long expiresIn) {
    }

    @Transactional
    public LoginResult login(String provider, String token) {
        OAuthVerifier verifier = oAuthVerifierResolver.resolve(provider);
        OAuthUserInfo info = verifier.verify(token);

        Member member = memberRepository.findByProviderAndProviderId(provider, info.providerId()).orElse(null);
        boolean isFirstLogin = member == null;
        if (member == null) {
            member = createMember(provider, info);
        }

        String accessToken = jwtProvider.generateAccessToken(member.getId(), member.getEmail());
        String refreshToken = issueRefreshToken(member);

        // Phase 1 범위에는 프로젝트 상태(status)가 없어 재개할 프로젝트를 판별할 수 없다.
        boolean onboardingCompleted = onboardingRepository.existsByMemberIdAndCompletedAtIsNotNull(member.getId());
        String resumeProjectId = projectRepository
                .findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(member.getId(), com.genmark.ai.entity.Project.Status.COMPLETED)
                .map(com.genmark.ai.entity.Project::getPublicId)
                .orElse(null);
        return new LoginResult(accessToken, refreshToken, jwtProvider.getAccessTokenExpirationSeconds(),
                member, isFirstLogin, onboardingCompleted, resumeProjectId);
    }

    @Transactional
    public RefreshResult refresh(String rawRefreshToken) {
        Member member = findByValidRefreshToken(rawRefreshToken);
        String accessToken = jwtProvider.generateAccessToken(member.getId(), member.getEmail());
        String newRefreshToken = issueRefreshToken(member);
        return new RefreshResult(accessToken, newRefreshToken, jwtProvider.getAccessTokenExpirationSeconds());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String hash = TokenHasher.sha256Hex(rawRefreshToken);
        memberRepository.findByRefreshTokenHash(hash).ifPresent(member -> {
            member.setRefreshTokenHash(null);
            member.setRefreshTokenExpiresAt(null);
        });
    }

    @Transactional(readOnly = true)
    public Member getMember(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED, "사용자를 찾을 수 없습니다."));
    }

    @Transactional(readOnly = true)
    public boolean isOnboardingCompleted(Long memberId) {
        return onboardingRepository.existsByMemberIdAndCompletedAtIsNotNull(memberId);
    }

    private Member createMember(String provider, OAuthUserInfo info) {
        String email = resolveEmail(provider, info);
        String name = (info.name() == null || info.name().isBlank()) ? (provider + " 사용자") : info.name();

        Member member = Member.builder()
                .email(email)
                .name(name)
                .provider(provider)
                .providerId(info.providerId())
                .build();
        return memberRepository.save(member);
    }

    /**
     * members.email은 provider와 무관하게 UNIQUE + NOT NULL이다. 카카오 이메일 동의를
     * 거부했거나, 이미 다른 provider 계정이 같은 이메일을 쓰고 있으면 합성 이메일로 대체한다.
     * 실제 계정 연동(같은 사람의 구글/카카오 계정을 하나로 합치는 것)은 Phase 2 이후 과제다.
     */
    private String resolveEmail(String provider, OAuthUserInfo info) {
        String candidate = info.email();
        if (candidate == null || candidate.isBlank() || memberRepository.existsByEmail(candidate)) {
            return provider + "+" + info.providerId() + "@oauth.genmark.local";
        }
        return candidate;
    }

    private Member findByValidRefreshToken(String rawRefreshToken) {
        String hash = TokenHasher.sha256Hex(rawRefreshToken);
        Member member = memberRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.TOKEN_EXPIRED, "리프레시 토큰이 유효하지 않습니다."));
        if (member.getRefreshTokenExpiresAt() == null || member.getRefreshTokenExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED, "리프레시 토큰이 만료되었습니다.");
        }
        return member;
    }

    /** 리프레시 토큰은 사용할 때마다 새로 발급(rotate)한다. */
    private String issueRefreshToken(Member member) {
        String rawToken = TokenHasher.generateOpaqueToken("rt_");
        member.setRefreshTokenHash(TokenHasher.sha256Hex(rawToken));
        member.setRefreshTokenExpiresAt(LocalDateTime.now().plusDays(refreshTokenExpirationDays));
        memberRepository.save(member);
        return rawToken;
    }
}
