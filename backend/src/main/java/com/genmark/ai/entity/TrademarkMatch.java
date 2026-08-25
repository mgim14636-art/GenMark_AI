package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "trademark_matches", uniqueConstraints = {
        @UniqueConstraint(name = "uq_match_rank", columnNames = {"analysis_id", "match_rank"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrademarkMatch {
    /** KIPRIS 등록 상표 매치인지, 관리자가 등록해둔 자체 생성 로고 매치인지. */
    public enum Source { KIPRIS, GENERATED }

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

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 20, columnDefinition = "VARCHAR(20)")
    private Source source;
}
