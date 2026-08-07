package com.genmark.ai.controller;

import com.genmark.ai.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/member")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping("/login")
    public String loginPage() {
        return "member/login";
    }

    @GetMapping("/join")
    public String joinPage() {
        return "member/join";
    }

    @PostMapping("/join")
    public String join(@RequestParam String email,
                       @RequestParam String password,
                       @RequestParam String name) {
        memberService.register(email, password, name);
        return "redirect:/member/login";
    }
}
