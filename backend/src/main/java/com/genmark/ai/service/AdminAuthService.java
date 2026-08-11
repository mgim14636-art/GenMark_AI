package com.genmark.ai.service;

import com.genmark.ai.entity.Admin;
import com.genmark.ai.repository.AdminRepository;
import com.genmark.ai.security.JwtProvider;
import com.genmark.ai.web.dto.admin.AdminLoginRequest;
import com.genmark.ai.web.dto.admin.AdminLoginResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 관리자 로그인. 일반 회원 로그인({@link AuthService})과 완전히 분리되어 있다.
 *
 * <p>회원가입 기능은 없다. 계정은 admins 테이블에 직접 INSERT로 넣는다.
 * 발급하는 토큰에는 {@code typ=admin} 클레임이 붙어 관리자 API에서만 통한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAuthService {

    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Transactional
    public AdminLoginResponse login(AdminLoginRequest request) {
        Admin admin = adminRepository.findByLoginId(request.loginId())
                // 아이디가 없는 경우와 비밀번호가 틀린 경우를 같은 오류로 응답한다.
                // 구분해서 알려주면 어떤 아이디가 존재하는지 알려주는 셈이 된다.
                .orElseThrow(() -> new ApiException(ErrorCode.ADMIN_LOGIN_FAILED));

        if (!passwordEncoder.matches(request.password(), admin.getPasswordHash())) {
            throw new ApiException(ErrorCode.ADMIN_LOGIN_FAILED);
        }

        admin.setLastLoginAt(LocalDateTime.now());
        String accessToken = jwtProvider.generateAdminAccessToken(admin.getId(), admin.getLoginId());
        return new AdminLoginResponse(accessToken, jwtProvider.getAccessTokenExpirationSeconds(),
                admin.getLoginId(), admin.getName());
    }
}
