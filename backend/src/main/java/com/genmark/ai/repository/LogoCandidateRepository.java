package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LogoCandidateRepository extends JpaRepository<LogoCandidate, Long> {
    Optional<LogoCandidate> findByPublicId(String publicId);

    Optional<LogoCandidate> findByPublicIdAndGenerationCiProjectMemberId(String publicId, Long memberId);
    Optional<LogoCandidate> findByPublicIdAndGenerationBiProjectMemberId(String publicId, Long memberId);

    List<LogoCandidate> findByGenerationIdOrderByCandidateOrder(Long generationId);

    @EntityGraph(attributePaths = {"generation", "generation.ciProject", "generation.biProject"})
    List<LogoCandidate> findByGenerationCiProjectMemberIdAndGenerationStatusOrderByCreatedAtDesc(
            Long memberId, LogoGeneration.Status status);
    @EntityGraph(attributePaths = {"generation", "generation.ciProject", "generation.biProject"})
    List<LogoCandidate> findByGenerationBiProjectMemberIdAndGenerationStatusOrderByCreatedAtDesc(
            Long memberId, LogoGeneration.Status status);

    Optional<LogoCandidate> findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
            String publicId, Long ciProjectId, Long memberId);
    Optional<LogoCandidate> findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
            String publicId, Long biProjectId, Long memberId);

    Optional<LogoCandidate> findFirstByGenerationCiProjectIdAndSelectedTrue(Long ciProjectId);
    Optional<LogoCandidate> findFirstByGenerationBiProjectIdAndSelectedTrue(Long biProjectId);

    List<LogoCandidate> findByGenerationCiProjectIdAndSelectedTrue(Long ciProjectId);
    List<LogoCandidate> findByGenerationBiProjectIdAndSelectedTrue(Long biProjectId);

    /** 내 찜 목록 (CI 프로젝트 쪽). 최근에 찜한 것부터. */
    List<LogoCandidate> findByGenerationCiProjectMemberIdAndPinnedAtIsNotNullOrderByPinnedAtDesc(Long memberId);

    /** 내 찜 목록 (BI 프로젝트 쪽). */
    List<LogoCandidate> findByGenerationBiProjectMemberIdAndPinnedAtIsNotNullOrderByPinnedAtDesc(Long memberId);

    /** 보관 기간(3일)이 지난 찜을 찾아 해제하기 위한 조회. idx_candidate_pinned 인덱스를 탄다. */
    List<LogoCandidate> findByPinnedAtIsNotNullAndPinnedAtBefore(LocalDateTime threshold);
}
