package com.genmark.ai.repository;

import com.genmark.ai.entity.CreditHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CreditHistoryRepository extends JpaRepository<CreditHistory, Long> {
    /** 특정 회원의 크레딧 변동 내역을 최신순으로. */
    List<CreditHistory> findByMemberIdOrderByCreatedAtDesc(Long memberId);
}
