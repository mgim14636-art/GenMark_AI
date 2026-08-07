package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "logo_generations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_logo_generation_idempotency", columnNames = {"project_id", "idempotency_key"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LogoGeneration {
    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_generation_project"))
    private Project project;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private Status status = Status.QUEUED;

    @Column(name = "candidate_count", nullable = false)
    @Builder.Default
    private int candidateCount = 4;

    @Column(name = "model_name", length = 100)
    private String modelName;

    @Column(name = "request_snapshot_json", nullable = false, columnDefinition = "TEXT")
    private String requestSnapshotJson;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now(); updatedAt = createdAt;
    }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }
}
