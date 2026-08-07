package com.genmark.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.Project;
import com.genmark.ai.exception.BusinessException;
import com.genmark.ai.repository.ProjectRepository;
import com.genmark.ai.web.dto.project.ProjectResponse;
import com.genmark.ai.web.dto.project.ProjectUpsertRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    // Legacy Thymeleaf compatibility.
    @Transactional
    public Project createProject(Member member, String title, String description) {
        return projectRepository.save(Project.builder()
                .member(member).title(title).description(description).build());
    }

    public List<Project> getProjectsByMember(Long memberId) { return projectRepository.findByMemberId(memberId); }

    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Project not found: " + id));
    }

    @Transactional
    public ProjectResponse create(Long memberId, Member member, ProjectUpsertRequest request) {
        Project project = Project.builder().member(member).build();
        apply(project, request);
        return toResponse(projectRepository.save(project));
    }

    public Project requireOwned(String publicId, Long memberId) {
        return projectRepository.findByPublicIdAndMemberId(publicId, memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    public ProjectResponse get(String publicId, Long memberId) { return toResponse(requireOwned(publicId, memberId)); }

    @Transactional
    public ProjectResponse update(String publicId, Long memberId, ProjectUpsertRequest request) {
        Project project = requireOwned(publicId, memberId);
        apply(project, request);
        return toResponse(project);
    }

    @Transactional
    public Project createInitial(Member member, ProjectUpsertRequest request) {
        Project project = Project.builder().member(member).build();
        apply(project, request);
        project.setStatus(Project.Status.BRIEF_READY);
        return projectRepository.save(project);
    }

    public ProjectResponse toResponse(Project project) {
        return new ProjectResponse(project.getPublicId(), project.getStatus(), project.getBrandType(),
                project.getIndustry(), project.getBrandName(), project.getCompanyName(), project.getCompanyMotto(),
                readList(project.getBrandValuesJson()), project.getBrandValuesText(), project.getTargetAge(),
                project.getTone(), project.getColorMode(), readList(project.getColorsJson()), project.getLogoStyle(),
                project.isIncludeBrandName(), project.getAdditionalRequirements(), project.getCreatedAt(), project.getUpdatedAt());
    }

    private void apply(Project p, ProjectUpsertRequest r) {
        if (r == null) return;
        if (r.brandType() != null) p.setBrandType(r.brandType());
        if (r.industry() != null) p.setIndustry(r.industry());
        if (r.brandName() != null) p.setBrandName(r.brandName());
        if (r.companyName() != null) p.setCompanyName(r.companyName());
        if (r.companyMotto() != null) p.setCompanyMotto(r.companyMotto());
        if (r.brandValues() != null) p.setBrandValuesJson(writeList(r.brandValues()));
        if (r.brandValuesText() != null) p.setBrandValuesText(r.brandValuesText());
        if (r.targetAge() != null) p.setTargetAge(r.targetAge());
        if (r.tone() != null) p.setTone(r.tone());
        if (r.colorMode() != null) p.setColorMode(r.colorMode());
        if (r.colors() != null) p.setColorsJson(writeList(r.colors()));
        if (r.logoStyle() != null) p.setLogoStyle(r.logoStyle());
        if (r.includeBrandName() != null) p.setIncludeBrandName(r.includeBrandName());
        if (r.additionalRequirements() != null) p.setAdditionalRequirements(r.additionalRequirements());
        if (hasBrief(p)) p.setStatus(Project.Status.BRIEF_READY);
    }

    private boolean hasBrief(Project p) {
        return p.getBrandName() != null && !p.getBrandName().isBlank()
                && p.getIndustry() != null && !p.getIndustry().isBlank();
    }

    public String writeList(List<String> values) {
        if (values == null) return null;
        try { return objectMapper.writeValueAsString(values); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.VALIDATION_ERROR); }
    }

    public List<String> readList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.INTERNAL_ERROR); }
    }
}
