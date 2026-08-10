package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 관리자 계정. 일반 회원(members)과 완전히 분리된 테이블이다.
 *
 * <p>회원은 소셜 로그인만 쓰기 때문에 비밀번호가 없지만, 관리자는 아이디/비밀번호로 로그인한다.
 * 관리자 회원가입 화면은 만들지 않으며 계정은 DB에 직접 INSERT로 넣는다.
 *
 * <p>{@code passwordHash}에는 BCrypt로 암호화한 문자열만 넣는다. 평문 저장은 금지다.
 */
@Entity
@Table(name = "admins")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Admin {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 로그인 아이디. 이메일이 아니어도 된다 (예: admin). */
    @Column(name = "login_id", nullable = false, unique = true, length = 50)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 50)
    private String name;

    /** 마지막 로그인 성공 시각. 한 번도 로그인하지 않았으면 null. */
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
