package com.genmark.ai.controller;

import com.genmark.ai.common.ApiResponse;
import com.genmark.ai.dto.request.LogoGenerateRequest;
import com.genmark.ai.dto.response.LogoGenerateResponse;
import com.genmark.ai.entity.GeneratedLogo;
import com.genmark.ai.entity.Project;
import com.genmark.ai.service.LogoService;
import com.genmark.ai.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/logo")
@RequiredArgsConstructor
public class LogoController {

    private final LogoService logoService;
    private final ProjectService projectService;

    @GetMapping("/generate")
    public String generatePage(@RequestParam(required = false, defaultValue = "1") Long projectId, Model model) {
        model.addAttribute("projectId", projectId);
        return "logo/generate";
    }

    @PostMapping("/generate")
    @ResponseBody
    public ApiResponse<LogoGenerateResponse> generateLogo(@Valid @RequestBody LogoGenerateRequest request) {
        Project project = projectService.getProjectById(request.getProjectId());
        GeneratedLogo logo = logoService.generateLogo(project, request.getPrompt());

        LogoGenerateResponse response = LogoGenerateResponse.builder()
                .logoId(logo.getId())
                .projectId(project.getId())
                .prompt(logo.getPrompt())
                .imageUrl(logo.getImageUrl())
                .status(logo.getStatus())
                .build();

        return ApiResponse.success("Logo generated successfully", response);
    }

    @GetMapping("/result/{id}")
    public String resultPage(@PathVariable Long id, Model model) {
        GeneratedLogo logo = logoService.getLogoById(id);
        model.addAttribute("logo", logo);
        return "logo/result";
    }
}
