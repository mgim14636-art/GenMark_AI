package com.genmark.ai.repository;

import com.genmark.ai.entity.MemberOnboarding;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberOnboardingRepository extends JpaRepository<MemberOnboarding, Long> {
    boolean existsByMemberIdAndCompletedAtIsNotNull(Long memberId);
}
