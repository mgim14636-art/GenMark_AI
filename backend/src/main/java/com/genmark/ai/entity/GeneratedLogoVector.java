package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 관리자가 "벡터화" 버튼으로 등록한, GenMark가 생성한 로고 한 건의 표시(bookkeeping).
 *
 * <p>실제 임베딩 벡터 값은 여기 저장하지 않는다. AI 서버의 generation-data 볼륨
 * (embeddings.npy + ids.csv, KIPRIS 인덱스와 같은 형식이지만 완전히 분리된 별도
 * 파일)에 {@code candidate.getPublicId()}를 키로 저장된다. 이 테이블은 "어떤
 * 후보를 벡터화했는지"와 화면에 보여줄 정보(회원·프로젝트 등은 candidate를 통해
 * 조회)만 들고 있는다.
 *
 * <p>{@code candidate}가 유니크라서 같은 로고를 두 번 벡터화해도 행이 하나만 남는다.
 */
@Entity
@Table(name = "generated_logo_vectors")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GeneratedLogoVector {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, unique = true, foreignKey = @ForeignKey(name = "fk_generated_vector_candidate"))
    private LogoCandidate candidate;

    @Column(name = "vectorized_at", nullable = false, updatable = false)
    private LocalDateTime vectorizedAt;

    @PrePersist
    void onCreate() {
        if (vectorizedAt == null) vectorizedAt = LocalDateTime.now();
    }
}
