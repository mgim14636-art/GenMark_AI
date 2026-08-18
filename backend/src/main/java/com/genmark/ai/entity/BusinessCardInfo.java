package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** A snapshot of the contact information used for one business-card generation. */
@Entity
@Table(name = "business_card_infos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BusinessCardInfo {

    @Id
    @Column(name = "brand_kit_id")
    private Long brandKitId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_kit_id", foreignKey = @ForeignKey(name = "fk_business_card_info_kit"))
    private BrandKit brandKit;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(length = 40)
    private String title;

    @Column(length = 60)
    private String company;

    @Column(length = 40)
    private String phone;

    @Column(length = 80)
    private String email;

    @Column(length = 120)
    private String address;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
