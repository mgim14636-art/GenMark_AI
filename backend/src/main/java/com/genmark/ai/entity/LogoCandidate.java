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

    /** 이 프로젝트에서 최종 채택한 로고인지. 프로젝트당 한 개만 true가 된다. */
    @Column(nullable = false)
    private boolean selected;

    /**
     * 찜(임시 보관)한 시각. null이면 찜하지 않은 상태다.
     *
     * <p>찜은 3일 뒤 자동 해제되므로 켜짐/꺼짐이 아니라 "언제 찜했는지"가 필요하다.
     * 찜(보류) / {@link #selected}(채택) / 다운로드(내려받음)는 서로 다른 상태이며 섞이지 않는다.
     */
    @Column(name = "pinned_at")
    private LocalDateTime pinnedAt;

    /** AI가 돌려준 부가 정보(시드, 프롬프트 등). 재생성 시 부정 프롬프트를 만드는 데 쓴다. */
    @Column(name = "ai_metadata_json", columnDefinition = "TEXT")
    private String aiMetadataJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}
