package com.genmark.ai.repository;

import com.genmark.ai.entity.TrademarkAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.time.LocalDateTime;
import java.util.List;

public interface TrademarkAnalysisRepository extends JpaRepository<TrademarkAnalysis, Long> {
    Optional<TrademarkAnalysis> findByPublicIdAndCandidateGenerationCiProjectMemberId(String publicId, Long memberId);
    Optional<TrademarkAnalysis> findByPublicIdAndCandidateGenerationBiProjectMemberId(String publicId, Long memberId);
    List<TrademarkAnalysis> findByStatusAndStartedAtBefore(TrademarkAnalysis.Status status, LocalDateTime threshold);
}
