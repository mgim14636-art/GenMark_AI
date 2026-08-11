package com.genmark.ai.repository;

import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BiProjectRepository extends JpaRepository<BiProject, Long> {
    List<BiProject> findByMemberId(Long memberId);
    Optional<BiProject> findByPublicIdAndMemberId(String publicId, Long memberId);
    Optional<BiProject> findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(Long memberId, ProjectStatus status);
}
