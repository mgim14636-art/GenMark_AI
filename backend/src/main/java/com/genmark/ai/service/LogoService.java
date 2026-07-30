package com.genmark.ai.service;

import com.genmark.ai.entity.GeneratedLogo;
import com.genmark.ai.entity.Project;
import com.genmark.ai.exception.BusinessException;
import com.genmark.ai.repository.LogoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LogoService {

    private final LogoRepository logoRepository;
    private final AiServerService aiServerService;

    @Transactional
    public GeneratedLogo generateLogo(Project project, String prompt) {
        String imageUrl = aiServerService.requestLogoGeneration(prompt);

        GeneratedLogo logo = GeneratedLogo.builder()
                .project(project)
                .prompt(prompt)
                .imageUrl(imageUrl)
                .status("COMPLETED")
                .build();

        return logoRepository.save(logo);
    }

    public List<GeneratedLogo> getLogosByProject(Long projectId) {
        return logoRepository.findByProjectId(projectId);
    }

    public GeneratedLogo getLogoById(Long id) {
        return logoRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Logo not found: " + id));
    }
}
