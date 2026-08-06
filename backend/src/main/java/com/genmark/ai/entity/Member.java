package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "members",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_member_provider_provider_id",
        columnNames = {"provider", "provider_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    /** 소셜 로그인(provider != "local") 회원은 비밀번호가 없다. */
    @Column(length = 255)
    private String password;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "ROLE_USER";

    /** local(이메일/비밀번호), google, kakao, 그리고 로컬 개발용 fake. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String provider = "local";

    @Column(name = "provider_id", length = 100)
    private String providerId;

    /** 리프레시 토큰 원문은 저장하지 않고 SHA-256 해시만 저장한다. */
    @Column(name = "refresh_token_hash", length = 128)
    private String refreshTokenHash;

    @Column(name = "refresh_token_expires_at")
    private LocalDateTime refreshTokenExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
