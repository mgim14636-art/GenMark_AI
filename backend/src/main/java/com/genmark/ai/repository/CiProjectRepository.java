package com.genmark.ai.repository;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CiProjectRepository extends JpaRepository<CiProject, Long> {
    List<CiProject> findByMemberId(Long memberId);
    Optional<CiProject> findByPublicIdAndMemberId(String publicId, Long memberId);
    Optional<CiProject> findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(Long memberId, ProjectStatus status);

    /**
     * 두 번째 CI부터 회사명·핵심가치를 자동으로 채워주기 위해 가장 최근 CI 한 건을 찾는다.
     * 새 컬럼 없이 이 조회만으로 자동 채움이 해결된다. idx_ci_project_member 인덱스를 탄다.
     */
    Optional<CiProject> findFirstByMemberIdOrderByCreatedAtDesc(Long memberId);
}
