package com.genmark.ai.repository;

import com.genmark.ai.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByMemberId(Long memberId);
    Optional<Project> findByPublicIdAndMemberId(String publicId, Long memberId);
    Optional<Project> findFirstByMemberIdAndStatusNotOrderByUpdatedAtDesc(Long memberId, Project.Status status);
}
