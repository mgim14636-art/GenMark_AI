package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LogoCandidateRepository extends JpaRepository<LogoCandidate, Long> {
    List<LogoCandidate> findByGenerationIdOrderByCandidateOrder(Long generationId);
    Optional<LogoCandidate> findByPublicIdAndGenerationProjectIdAndGenerationProjectMemberId(String publicId, Long projectId, Long memberId);
    Optional<LogoCandidate> findFirstByGenerationProjectIdAndSelectedTrue(Long projectId);
    List<LogoCandidate> findByGenerationProjectIdAndSelectedTrue(Long projectId);
}
