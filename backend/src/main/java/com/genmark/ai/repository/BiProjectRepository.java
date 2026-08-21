package com.genmark.ai.repository;

import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BiProjectRepository extends JpaRepository<BiProject, Long> {
    List<BiProject> findByMemberId(Long memberId);
    Optional<BiProject> findByPublicIdAndMemberId(String publicId, Long memberId);
    Optional<BiProject> findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(Long memberId, ProjectStatus status);

    /** 오래 방치된 미완성(DRAFT/BRIEF_READY) 초안을 자동 정리할 때 쓴다. */
    List<BiProject> findByStatusInAndUpdatedAtBefore(List<ProjectStatus> statuses, LocalDateTime threshold);
}
