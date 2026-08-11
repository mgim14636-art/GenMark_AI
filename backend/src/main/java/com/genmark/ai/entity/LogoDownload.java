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
 * <p>{@code uq_download_member_candidate} 제약 덕분에 같은 사람이 같은 로고를 두 번 받아도
 * 행이 하나만 남는다. 즉 "중복 다운로드는 1회로 집계"를 DB가 보장하므로 서비스 코드에서
 * 따로 세지 않아도 된다.
 */
@Entity
@Table(name = "logo_downloads", uniqueConstraints = {
        @UniqueConstraint(name = "uq_download_member_candidate", columnNames = {"member_id", "candidate_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LogoDownload {

    /** 통계 화면이 목록을 CI/BI로 나누고 보관 한도(각 20개)도 따로 세기 때문에 필요하다. */
    public enum ProjectType { CI, BI }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, foreignKey = @ForeignKey(name = "fk_download_member"))
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_download_candidate"))
    private LogoCandidate candidate;

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
