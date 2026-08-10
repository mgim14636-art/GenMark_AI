package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LogoCandidateRepository extends JpaRepository<LogoCandidate, Long> {
    List<LogoCandidate> findByGenerationIdOrderByCandidateOrder(Long generationId);

    Optional<LogoCandidate> findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
            String publicId, Long ciProjectId, Long memberId);
    Optional<LogoCandidate> findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
            String publicId, Long biProjectId, Long memberId);

    Optional<LogoCandidate> findFirstByGenerationCiProjectIdAndSelectedTrue(Long ciProjectId);
    Optional<LogoCandidate> findFirstByGenerationBiProjectIdAndSelectedTrue(Long biProjectId);

    List<LogoCandidate> findByGenerationCiProjectIdAndSelectedTrue(Long ciProjectId);
    List<LogoCandidate> findByGenerationBiProjectIdAndSelectedTrue(Long biProjectId);
}
