package com.genmark.ai.repository;

import com.genmark.ai.entity.SimilarityResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SimilarityResultRepository extends JpaRepository<SimilarityResult, Long> {
    List<SimilarityResult> findByLogoId(Long logoId);
}
