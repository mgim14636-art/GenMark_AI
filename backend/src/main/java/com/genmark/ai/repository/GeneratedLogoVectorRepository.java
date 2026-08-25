package com.genmark.ai.repository;

import com.genmark.ai.entity.GeneratedLogoVector;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GeneratedLogoVectorRepository extends JpaRepository<GeneratedLogoVector, Long> {
    Optional<GeneratedLogoVector> findByCandidateId(Long candidateId);

    @EntityGraph(attributePaths = {
            "candidate", "candidate.generation", "candidate.generation.ciProject", "candidate.generation.biProject"
    })
    List<GeneratedLogoVector> findAllByOrderByVectorizedAtDesc();
}
