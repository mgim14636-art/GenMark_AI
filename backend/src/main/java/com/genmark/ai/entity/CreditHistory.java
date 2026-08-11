package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 크레딧 증감 이력 한 건.
 *
 * <p>현재 잔액은 {@link Member#getCreditBalance()}에 들어 있고, 이 테이블은 "왜 그 잔액이 됐는지"를
 * 남긴다. 이력의 amount를 모두 더하면 잔액과 같아야 하므로 어긋나면 버그를 바로 알 수 있다.
 */
@Entity
@Table(name = "credit_histories")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CreditHistory {

    /**
     * 크레딧이 변동한 이유.
     *
     * <p>{@code GENERATE}와 {@code DOWNLOAD}를 모두 준비해 둔 것은 차감 시점이 아직
     * 확정되지 않았기 때문이다. 어느 쪽으로 정해져도 구조를 바꿀 필요가 없다.
     */
    public enum Reason { SIGNUP, SURVEY, GENERATE, DOWNLOAD }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, foreignKey = @ForeignKey(name = "fk_credit_member"))
    private Member member;

    /** 지급은 양수(+2), 차감은 음수(-1). */
    @Column(nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, columnDefinition = "VARCHAR(30)")
    private Reason reason;

    /** 이 변동이 반영된 직후의 잔액 스냅샷. */
    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }
}
