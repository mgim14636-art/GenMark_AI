package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "member_onboardings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberOnboarding {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "member_id", foreignKey = @ForeignKey(name = "fk_onboarding_member"))
    private Member member;

    @Column(name = "usage_1", nullable = false, length = 100)
    private String usage1;

    @Column(name = "usage_2", length = 100)
    private String usage2;

    @Column(name = "usage_3", length = 100)
    private String usage3;

    @Column(nullable = false, length = 100)
    private String audience;

    @Column(name = "completed_at", nullable = false)
    private LocalDateTime completedAt;

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
