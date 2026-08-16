package com.genmark.ai.repository;

import com.genmark.ai.entity.BrandKit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BrandKitRepository extends JpaRepository<BrandKit, Long> {

    Optional<BrandKit> findByPublicId(String publicId);

    /** 특정 로고로 만든 브랜드킷 목록. */
    List<BrandKit> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);

    List<BrandKit> findByCandidateGenerationCiProjectMemberIdOrderByCreatedAtDesc(Long memberId);

    List<BrandKit> findByCandidateGenerationBiProjectMemberIdOrderByCreatedAtDesc(Long memberId);

    /** 같은 로고 + 같은 종류로 이미 만들어둔 게 있으면 재사용한다. */
    Optional<BrandKit> findFirstByCandidateIdAndKitTypeAndStatusOrderByCompletedAtDesc(
            Long candidateId, BrandKit.KitType kitType, BrandKit.Status status);

    /** 서버 재시작으로 멈춰버린 작업 복구용 (StaleAiJobRecovery와 같은 목적). */
    List<BrandKit> findByStatusAndStartedAtBefore(BrandKit.Status status, LocalDateTime threshold);
}
