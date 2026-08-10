package com.genmark.ai.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 레거시 Thymeleaf 화면용 컨트롤러.
 * members.password 컬럼 제거와 함께 이메일/비밀번호 회원가입(/member/join)은 폐지했다.
 * 실제 로그인은 프론트엔드(React)의 소셜 로그인 → POST /api/v1/auth/login 경로만 사용한다.
 */
@Controller
@RequestMapping("/member")
public class MemberController {

    @GetMapping("/login")
    public String loginPage() {
        return "member/login";
    }
}
