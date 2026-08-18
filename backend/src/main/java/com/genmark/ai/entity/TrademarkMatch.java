package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "trademark_matches", uniqueConstraints = {
        @UniqueConstraint(name = "uq_match_rank", columnNames = {"analysis_id", "match_rank"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrademarkMatch {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "analysis_id", nullable = false, foreignKey = @ForeignKey(name = "fk_match_analysis"))
    private TrademarkAnalysis analysis;

    @Column(name = "match_rank", nullable = false)
    private int rank;
    @Column(name = "application_number", length = 100)
    private String applicationNumber;
    @Column(length = 255) private String name;
    @Column(length = 100) private String category;
    @Column(nullable = false) private int similarity;
    @Column(name = "image_path", length = 500) private String imagePath;
    @Column(columnDefinition = "TEXT") private String note;
}
