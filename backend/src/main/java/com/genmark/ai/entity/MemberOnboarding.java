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

    public enum DetailsDecision { SUBMITTED, SKIPPED }

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "member_id", foreignKey = @ForeignKey(name = "fk_onboarding_member"))
    private Member member;

    @Column(name = "usage_json", nullable = false, columnDefinition = "TEXT")
    private String usageJson;

    @Column(nullable = false, length = 100)
    private String audience;

    @Enumerated(EnumType.STRING)
    @Column(name = "details_decision", nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    private DetailsDecision detailsDecision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "initial_project_id", foreignKey = @ForeignKey(name = "fk_onboarding_project"))
    private Project initialProject;

    @Column(name = "completed_at", nullable = false)
    private LocalDateTime completedAt;

    @Column(name = "schema_version", nullable = false)
    @Builder.Default
    private int schemaVersion = 1;

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
