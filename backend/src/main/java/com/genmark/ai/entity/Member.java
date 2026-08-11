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

    @Column(nullable = false, length = 50)
    private String name;

    /**
     * google, kakao, 그리고 로컬 개발용 fake. 이메일/비밀번호 가입은 폐지됐으므로
     * 기본값 "local"은 기존 데이터 호환용으로만 남아 있고 신규 회원에는 쓰이지 않는다.
     */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String provider = "local";

    @Column(name = "provider_id", length = 100)
    private String providerId;

    /**
     * 남은 크레딧 개수. 가입 시 2개를 받고, 로고를 쓸 때 차감되며, 설문조사에 응하면 2개를 더 받는다.
     *
     * <p>조회가 매우 잦아서(화면 상단 표시, 관리자 회원관리 목록) 잔액은 여기에 직접 둔다.
     * 증감 내역은 {@link CreditHistory}에 따로 쌓이며, 그 합계는 이 값과 같아야 한다.
     */
    @Column(name = "credit_balance", nullable = false)
    @Builder.Default
    private int creditBalance = 2;

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
