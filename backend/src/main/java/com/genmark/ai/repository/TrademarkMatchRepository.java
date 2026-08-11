package com.genmark.ai.repository;

import com.genmark.ai.entity.TrademarkMatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TrademarkMatchRepository extends JpaRepository<TrademarkMatch, Long> {
    List<TrademarkMatch> findByAnalysisIdOrderByRank(Long analysisId);
    Optional<TrademarkMatch> findByAnalysisIdAndRank(Long analysisId, int rank);
}
