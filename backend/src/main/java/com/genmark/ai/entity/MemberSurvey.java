package com.genmark.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 설문조사 응답 기록. 응답하면 크레딧 1개를 추가로 지급한다.
 *
 * <p>{@code memberId}가 기본키라서 회원당 1행만 존재할 수 있다. 한 사람이 설문을 여러 번 내고
 * 크레딧을 반복 수령하는 것을 DB가 직접 막는다. {@link MemberOnboarding}과 같은 구조다.
 *
 * <p>답변 필드는 기존 body 없는 제출과 호환하기 위해 nullable이다.
 */
@Entity
@Table(name = "member_surveys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MemberSurvey {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "member_id", foreignKey = @ForeignKey(name = "fk_survey_member"))
    private Member member;

    @Column(name = "completed_at", nullable = false)
    private LocalDateTime completedAt;

    /**
     * 크레딧 1개를 실제로 지급했는지 여부.
     * 응답 기록과 지급은 같은 트랜잭션에서 처리하지만, 지급 단계에서 문제가 생겼을 때
     * "응답은 했는데 아직 못 받은 사람"을 이 값으로 찾아낼 수 있다.
     */
    @Column(nullable = false)
    private boolean credited;

    @Column(columnDefinition = "TINYINT")
    private Integer rating;

    @Column(name = "improvements_json", columnDefinition = "TEXT")
    private String improvementsJson;

    @Column(length = 500)
    private String comment;

    @Column(name = "survey_version", nullable = false, columnDefinition = "SMALLINT")
    @Builder.Default
    private int surveyVersion = 1;

    @PrePersist
    void onCreate() {
        if (completedAt == null) completedAt = LocalDateTime.now();
    }
}
