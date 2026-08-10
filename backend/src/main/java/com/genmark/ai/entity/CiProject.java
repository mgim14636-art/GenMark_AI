package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "ci_project", indexes = {
        @Index(name = "idx_ci_project_member", columnList = "member_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CiProject implements ProjectLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_ci_project_member"))
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    @Builder.Default
    private ProjectStatus status = ProjectStatus.DRAFT;

    @Column(name = "current_step", nullable = false, columnDefinition = "TINYINT")
    @Builder.Default
    private int currentStep = 1;

    @Column(nullable = false, length = 100)
    private String industry;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "core_values", length = 300)
    private String coreValues;

    @Column(length = 100, nullable = false)
    @Builder.Default
    private String tone = "friendly";

    @Column(name = "color_1", nullable = false, length = 7)
    private String color1;

    @Column(name = "color_2", nullable = false, length = 7)
    private String color2;

    @Column(name = "color_3", length = 7)
    private String color3;

    @Column(name = "color_4", length = 7)
    private String color4;

    @Column(name = "logo_style", nullable = false, length = 50)
    @Builder.Default
    private String logoStyle = "combination";

    @Column(name = "additional_requirements", length = 300)
    private String additionalRequirements;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (publicId == null) publicId = UUID.randomUUID().toString();
        if (status == null) status = ProjectStatus.DRAFT;
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Override
    public Map<String, Object> toSurvey() {
        Map<String, Object> survey = new LinkedHashMap<>();
        survey.put("ci_bi", "CI");
        survey.put("company_name", companyName);
        survey.put("industry", industry);
        survey.put("company_values_text", coreValues);
        survey.put("tone", tone);
        survey.put("color_mode", "MANUAL");
        survey.put("color_manual", colorList());
        survey.put("style", logoStyle);
        survey.put("additional_requirements", additionalRequirements);
        survey.put("num_variants", 4);
        return survey;
    }
}
