package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "projects", indexes = {
        @Index(name = "idx_projects_member", columnList = "member_id"),
        @Index(name = "idx_projects_member_status", columnList = "member_id,status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {

    public enum Status { DRAFT, BRIEF_READY, GENERATING, RESULT_READY, ANALYZING, COMPLETED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_projects_member"))
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private Status status = Status.DRAFT;

    // Legacy Thymeleaf screens still read these two columns.
    @Column(length = 100)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "brand_type", length = 50)
    private String brandType;

    @Column(length = 100)
    private String industry;

    @Column(name = "brand_name", length = 150)
    private String brandName;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "company_motto", length = 255)
    private String companyMotto;

    @Column(name = "brand_values_json", columnDefinition = "TEXT")
    private String brandValuesJson;

    @Column(name = "brand_values_text", columnDefinition = "TEXT")
    private String brandValuesText;

    @Column(name = "target_age", length = 50)
    private String targetAge;

    @Column(length = 100)
    private String tone;

    @Column(name = "color_mode", length = 30)
    private String colorMode;

    @Column(name = "colors_json", columnDefinition = "TEXT")
    private String colorsJson;

    @Column(name = "logo_style", length = 50)
    private String logoStyle;

    @Column(name = "include_brand_name", nullable = false)
    @Builder.Default
    private boolean includeBrandName = true;

    @Column(name = "additional_requirements", columnDefinition = "TEXT")
    private String additionalRequirements;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        if (status == null) status = Status.DRAFT;
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
