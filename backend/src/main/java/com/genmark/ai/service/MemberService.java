package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.exception.BusinessException;
import com.genmark.ai.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Member register(String email, String password, String name) {
        if (memberRepository.existsByEmail(email)) {
            throw new BusinessException("Email already exists: " + email);
        }

        Member member = Member.builder()
                .email(email)
                .password(passwordEncoder.encode(password))
                .name(name)
                .role("ROLE_USER")
                .build();

        return memberRepository.save(member);
    }

    public Member findByEmail(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("Member not found for email: " + email));
    }
}
