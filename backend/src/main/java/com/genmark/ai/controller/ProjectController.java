package com.genmark.ai.controller;

import com.genmark.ai.entity.Project;
import com.genmark.ai.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
@RequestMapping("/project")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping("/list")
    public String listProjects(Model model) {
        List<Project> projects = projectService.getProjectsByMember(1L);
        model.addAttribute("projects", projects);
        return "project/list";
    }

    @GetMapping("/{id}")
    public String projectDetail(@PathVariable Long id, Model model) {
        Project project = projectService.getProjectById(id);
        model.addAttribute("project", project);
        return "project/detail";
    }
}
