package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoGeneration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LogoGenerationRepository extends JpaRepository<LogoGeneration, Long> {
    Optional<LogoGeneration> findByPublicIdAndProjectMemberId(String publicId, Long memberId);
    Optional<LogoGeneration> findByProjectIdAndIdempotencyKey(Long projectId, String idempotencyKey);
    List<LogoGeneration> findByStatusAndStartedAtBefore(LogoGeneration.Status status, LocalDateTime threshold);
}
