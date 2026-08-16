package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

@Entity
@Table(name = "bi_project", indexes = {
        @Index(name = "idx_bi_project_member", columnList = "member_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiProject implements ProjectLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 36, updatable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_bi_project_member"))
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

    @Column(name = "brand_name", length = 150)
    private String brandName;

    @Column(name = "value_category_1", length = 50)
    private String valueCategory1;

    @Column(name = "value_category_2", length = 50)
    private String valueCategory2;

    @Column(name = "value_category_3", length = 50)
    private String valueCategory3;

    @Column(name = "brand_description", length = 300)
    private String brandDescription;

    @Column(name = "target_age", nullable = false, length = 20)
    @Builder.Default
    private String targetAge = "전 연령층";

    @Column(length = 100, nullable = false)
    @Builder.Default
    private String tone = "friendly";

    @Column(name = "color_mode", nullable = false, length = 20)
    @Builder.Default
    private String colorMode = "TONE";

    /**
     * brand-brief 단계만 제출한 상태에서는 아직 색상을 고르지 않아 null일 수 있다
     * (F9 이어쓰기가 이 단계부터도 동작하도록 하기 위함). 실제 로고 생성은 항상 tone
     * 단계를 지난 뒤에만 시작되므로, 그 시점엔 이미 채워져 있다.
     */
    @Column(name = "color_1", length = 7)
    private String color1;

    @Column(name = "color_2", length = 7)
    private String color2;

    @Column(name = "color_3", length = 7)
    private String color3;

    @Column(name = "color_4", length = 7)
    private String color4;

    @Column(name = "logo_style", nullable = false, length = 50)
    @Builder.Default
    private String logoStyle = "combination";

    @Column(name = "logo_shape", length = 100)
    private String logoShape;

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

    private List<String> valueCategoryList() {
        return Stream.of(valueCategory1, valueCategory2, valueCategory3)
                .filter(Objects::nonNull)
                .toList();
    }

    @Override
    public Map<String, Object> toSurvey() {
        Map<String, Object> survey = new LinkedHashMap<>();
        survey.put("ci_bi", "BI");
        survey.put("brand_name", brandName);
        survey.put("industry", industry);
        survey.put("brand_values", valueCategoryList());
        survey.put("brand_values_text", brandDescription);
        survey.put("target_age", targetAge);
        survey.put("tone", tone);
        boolean manualColor = "MANUAL".equalsIgnoreCase(colorMode);
        survey.put("color_mode", manualColor ? "manual" : "ai");
        if (manualColor) survey.put("color_manual", colorList());
        survey.put("style", logoStyle);
        survey.put("logo_shape", logoShape);
        survey.put("include_brand_name_in_logo", !"symbol".equalsIgnoreCase(logoStyle));
        survey.put("additional_requirements", additionalRequirements);
        survey.put("num_variants", 1);
        return survey;
    }
}
