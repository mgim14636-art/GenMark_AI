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
}
