package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 사용자가 실제로 내려받은 로고 한 장의 기록.
 *
 * <p>저장 공간을 아끼기 위해 "다운로드한 로고만" 서버에 보관한다. {@code storageKey}가 그
 * 보관본의 경로다. 생성만 하고 받지 않은 로고는 보관 대상이 아니다.
 *
 * <p>{@code uq_download_member_candidate_revision} 제약 덕분에 같은 사람이 <b>같은 모습의</b>
 * 로고를 두 번 받아도 행이 하나만 남는다. 로고를 수정한 뒤 다시 받으면 리비전이 달라지므로
 * 별도의 기록이 된다 — 실제로 서로 다른 그림 두 장을 받은 것이기 때문이다.
 */
@Entity
@Table(name = "logo_downloads", uniqueConstraints = {
        @UniqueConstraint(name = "uq_download_member_candidate_revision",
                columnNames = {"member_id", "candidate_id", "asset_revision"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LogoDownload {

    /** 통계 화면이 목록을 CI/BI로 나누고 보관 한도(각 20개)도 따로 세기 때문에 필요하다. */
    public enum ProjectType { CI, BI }

    /** 수정 이력이 없는(=AI가 처음 만든) 로고를 가리키는 리비전 값. */
    public static final String ORIGINAL_REVISION = "original";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, foreignKey = @ForeignKey(name = "fk_download_member"))
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_download_candidate"))
    private LogoCandidate candidate;

    /**
     * 받은 시점의 로고 버전 (logo_candidates.ai_metadata_json.svgRevision).
     * 한 번도 수정하지 않은 원본은 {@link #ORIGINAL_REVISION}.
     *
     * <p>NULL을 쓰지 않는다 — UNIQUE 인덱스가 NULL끼리는 중복으로 보지 않아서, 원본을
     * 여러 번 받을 때마다 기록이 늘어나 버린다.
     */
    @Column(name = "asset_revision", nullable = false, length = 64)
    private String assetRevision;

    /**
     * candidate -> generation -> project 를 따라가면 알 수 있지만, 조인 없이 바로 걸러내려고
     * 비정규화해서 들고 있는다. 한도 정리 쿼리가 이 값으로 자주 필터링한다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "project_type", nullable = false, length = 2, columnDefinition = "VARCHAR(2)")
    private ProjectType projectType;

    /** 보관 중인 이미지 파일 경로 (uploads 디렉터리 기준 상대 경로). */
    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "downloaded_at", nullable = false, updatable = false)
    private LocalDateTime downloadedAt;

    @PrePersist
    void onCreate() { downloadedAt = LocalDateTime.now(); }
}
