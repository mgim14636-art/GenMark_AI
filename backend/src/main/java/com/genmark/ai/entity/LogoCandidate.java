package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "logo_candidates", uniqueConstraints = {
        @UniqueConstraint(name = "uq_candidate_order", columnNames = {"generation_id", "candidate_order"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LogoCandidate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generation_id", nullable = false, foreignKey = @ForeignKey(name = "fk_candidate_generation"))
    private LogoGeneration generation;

    @Column(name = "candidate_order", nullable = false)
    private int candidateOrder;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, length = 50)
    @Builder.Default
    private String mimeType = "image/png";

    private Integer width;
    private Integer height;

    @Column(nullable = false)
    private boolean selected;

    @Column(nullable = false)
    private boolean saved;

    @Column(name = "ai_metadata_json", columnDefinition = "TEXT")
    private String aiMetadataJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}
