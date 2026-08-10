package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "logo_generations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_ci_generation_idempotency", columnNames = {"ci_project_id", "idempotency_key"}),
        @UniqueConstraint(name = "uq_bi_generation_idempotency", columnNames = {"bi_project_id", "idempotency_key"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LogoGeneration {
    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ci_project_id", foreignKey = @ForeignKey(name = "fk_generation_ci_project"))
    private CiProject ciProject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bi_project_id", foreignKey = @ForeignKey(name = "fk_generation_bi_project"))
    private BiProject biProject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private Status status = Status.QUEUED;

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

    /** Whichever of ci_project_id / bi_project_id is set (the DB CHECK guarantees exactly one is). */
    public ProjectLike getProject() {
        return ciProject != null ? ciProject : biProject;
    }

    public void setProject(ProjectLike project) {
        if (project instanceof CiProject ci) {
            this.ciProject = ci;
            this.biProject = null;
        } else if (project instanceof BiProject bi) {
            this.biProject = bi;
            this.ciProject = null;
        } else {
            throw new IllegalArgumentException("Unknown project type: " + project);
        }
    }
}
