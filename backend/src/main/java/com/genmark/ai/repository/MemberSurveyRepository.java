package com.genmark.ai.repository;

import com.genmark.ai.entity.MemberSurvey;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberSurveyRepository extends JpaRepository<MemberSurvey, Long> {
    /** 이미 설문에 응했는지. 회원당 1행이라 존재 여부만 보면 된다. */
    boolean existsByMemberId(Long memberId);
}
