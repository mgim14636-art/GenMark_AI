package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "similarity_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SimilarityResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "logo_id", nullable = false)
    private GeneratedLogo logo;

    @Column(name = "matched_trademark_id", nullable = false, length = 100)
    private String matchedTrademarkId;

    @Column(name = "matched_trademark_name", length = 100)
    private String matchedTrademarkName;

    @Column(name = "similarity_score", nullable = false)
    private Float similarityScore;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
