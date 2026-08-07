package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "trademark_analyses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrademarkAnalysis {
    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED }
    public enum RiskLevel { SAFE, MODERATE, CAUTION }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_analysis_project"))
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_analysis_candidate"))
    private LogoCandidate candidate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private Status status = Status.QUEUED;

    @Column(name = "max_similarity")
    private Integer maxSimilarity;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", length = 20, columnDefinition = "VARCHAR(20)")
    private RiskLevel riskLevel;

    @Column(columnDefinition = "TEXT")
    private String disclaimer;
    @Column(name = "error_code", length = 50)
    private String errorCode;
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    @Column(name = "started_at") private LocalDateTime startedAt;
    @Column(name = "completed_at") private LocalDateTime completedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;

    @PrePersist void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now(); updatedAt = createdAt;
    }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }
}
