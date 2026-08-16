package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 브랜드킷 결과물. 완성된 로고를 실제 물건에 얹은 이미지다.
 *
 * <p>CI는 명함({@link KitType#BUSINESS_CARD}), BI는 제품 썸네일({@link KitType#THUMBNAIL})을 만든다.
 *
 * <p>AI가 이미지를 만드는 작업이라 시간이 걸리고 실패할 수 있으므로,
 * {@link LogoGeneration}·{@link TrademarkAnalysis}와 같은 비동기 구조
 * (status + error + 시작/완료 시각)를 그대로 따른다.
 */
@Entity
@Table(name = "brand_kits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BrandKit {

    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED }

    /** BUSINESS_CARD = 명함(CI용), THUMBNAIL = 제품 썸네일(BI용). */
    public enum KitType { BUSINESS_CARD, THUMBNAIL }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    /** 브랜드킷은 프로젝트가 아니라 로고 후보 한 장에 달린다. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_kit_candidate"))
    private LogoCandidate candidate;

    @Enumerated(EnumType.STRING)
    @Column(name = "kit_type", nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    private KitType kitType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private Status status = Status.QUEUED;

    /** 완성된 이미지 경로. 완료 전에는 null. */
    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(nullable = false)
    @Builder.Default
    private boolean preliminary = false;

    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "warnings_json", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> warnings = List.of();

    @OneToOne(mappedBy = "brandKit", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private BusinessCardInfo businessCardInfo;

    /** 실패했을 때만 채워진다. 비동기라 화면에 실패 이유를 보여주려면 이 값이 필요하다. */
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

    @PrePersist
    void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public void setBusinessCardInfo(BusinessCardInfo businessCardInfo) {
        this.businessCardInfo = businessCardInfo;
        if (businessCardInfo != null) businessCardInfo.setBrandKit(this);
    }
}
