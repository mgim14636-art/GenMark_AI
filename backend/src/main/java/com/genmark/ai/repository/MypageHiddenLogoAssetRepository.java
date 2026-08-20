package com.genmark.ai.repository;

import com.genmark.ai.entity.MypageHiddenLogoAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MypageHiddenLogoAssetRepository extends JpaRepository<MypageHiddenLogoAsset, Long> {
    boolean existsByMemberIdAndCandidateId(Long memberId, Long candidateId);

    List<MypageHiddenLogoAsset> findByMemberIdOrderByHiddenAtDesc(Long memberId);
}
