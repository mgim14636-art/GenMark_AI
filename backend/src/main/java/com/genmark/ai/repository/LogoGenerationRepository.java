package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoGeneration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LogoGenerationRepository extends JpaRepository<LogoGeneration, Long> {
    Optional<LogoGeneration> findByPublicIdAndProjectIdAndProjectMemberId(String publicId, Long projectId, Long memberId);
    Optional<LogoGeneration> findByProjectIdAndIdempotencyKey(Long projectId, String idempotencyKey);
    Optional<LogoGeneration> findFirstByProjectIdAndStatusOrderByCompletedAtDesc(Long projectId, LogoGeneration.Status status);
    List<LogoGeneration> findByStatusAndStartedAtBefore(LogoGeneration.Status status, LocalDateTime threshold);
}
