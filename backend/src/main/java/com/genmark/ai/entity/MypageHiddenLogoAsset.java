package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 마이페이지에서만 숨긴 생성 로고. 프로젝트 원본과 파생 브랜드킷은 유지한다. */
@Entity
@Table(name = "mypage_hidden_logo_assets", uniqueConstraints = {
        @UniqueConstraint(name = "uq_mypage_hidden_member_candidate", columnNames = {"member_id", "candidate_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MypageHiddenLogoAsset {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, foreignKey = @ForeignKey(name = "fk_mypage_hidden_member"))
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_mypage_hidden_candidate"))
    private LogoCandidate candidate;

    @Column(name = "hidden_at", nullable = false, updatable = false)
    private LocalDateTime hiddenAt;

    @PrePersist
    void onCreate() {
        if (hiddenAt == null) hiddenAt = LocalDateTime.now();
    }
}
