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
}
