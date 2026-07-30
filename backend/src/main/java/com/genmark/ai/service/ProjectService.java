package com.genmark.ai.service;

import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.Project;
import com.genmark.ai.exception.BusinessException;
import com.genmark.ai.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;

    @Transactional
    public Project createProject(Member member, String title, String description) {
        Project project = Project.builder()
                .member(member)
                .title(title)
                .description(description)
                .build();

        return projectRepository.save(project);
    }

    public List<Project> getProjectsByMember(Long memberId) {
        return projectRepository.findByMemberId(memberId);
    }

    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Project not found: " + id));
    }
}
