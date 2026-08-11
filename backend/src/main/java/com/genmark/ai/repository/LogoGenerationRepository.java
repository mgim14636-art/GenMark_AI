package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoGeneration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LogoGenerationRepository extends JpaRepository<LogoGeneration, Long> {
    Optional<LogoGeneration> findByPublicIdAndCiProjectIdAndCiProjectMemberId(String publicId, Long ciProjectId, Long memberId);
    Optional<LogoGeneration> findByPublicIdAndBiProjectIdAndBiProjectMemberId(String publicId, Long biProjectId, Long memberId);

    Optional<LogoGeneration> findByCiProjectIdAndIdempotencyKey(Long ciProjectId, String idempotencyKey);
    Optional<LogoGeneration> findByBiProjectIdAndIdempotencyKey(Long biProjectId, String idempotencyKey);

    Optional<LogoGeneration> findFirstByCiProjectIdAndStatusOrderByCompletedAtDesc(Long ciProjectId, LogoGeneration.Status status);
    Optional<LogoGeneration> findFirstByBiProjectIdAndStatusOrderByCompletedAtDesc(Long biProjectId, LogoGeneration.Status status);

    List<LogoGeneration> findByStatusAndStartedAtBefore(LogoGeneration.Status status, LocalDateTime threshold);

    /**
     * 관리자 통계용 생성 건수. 로고 4개 한 묶음이 1건이므로 generation 행을 세면 그대로 건수가 된다.
     * 실패한 작업은 제외해야 하므로 status 조건을 함께 받는다.
     */
    long countByCiProjectMemberIdAndStatus(Long memberId, LogoGeneration.Status status);

    long countByBiProjectMemberIdAndStatus(Long memberId, LogoGeneration.Status status);

    long countByStatus(LogoGeneration.Status status);
}
