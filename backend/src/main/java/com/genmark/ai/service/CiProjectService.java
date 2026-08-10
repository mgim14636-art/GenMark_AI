package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.web.dto.project.CiProjectResponse;
import com.genmark.ai.web.dto.project.CiProjectUpsertRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CiProjectService {

    /** brand-brief/tone/logo-style/final-review page order shown to the user. */
    private static final Map<String, Integer> STEP_ORDER = Map.of(
            "brand-brief", 1, "tone", 2, "logo-style", 3, "final-review", 4);

    private final CiProjectRepository ciProjectRepository;

    @Transactional
    public CiProjectResponse create(Member member, CiProjectUpsertRequest request) {
        CiProject project = CiProject.builder().member(member).build();
        apply(project, request);
        return toResponse(ciProjectRepository.save(project));
    }

    public CiProject requireOwned(String publicId, Long memberId) {
        return ciProjectRepository.findByPublicIdAndMemberId(publicId, memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    public CiProjectResponse get(String publicId, Long memberId) {
        return toResponse(requireOwned(publicId, memberId));
    }

    @Transactional
    public CiProjectResponse update(String publicId, Long memberId, CiProjectUpsertRequest request) {
        CiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        return toResponse(project);
    }

    @Transactional
    public CiProjectResponse updateStep(String publicId, Long memberId, String step, CiProjectUpsertRequest request) {
        Integer stepNumber = STEP_ORDER.get(step);
        if (stepNumber == null) throw new ApiException(ErrorCode.VALIDATION_ERROR, "알 수 없는 온보딩 단계입니다: " + step);
        CiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        if (stepNumber > project.getCurrentStep()) project.setCurrentStep(stepNumber);
        return toResponse(project);
    }

    @Transactional
    public CiProject createInitial(Member member, CiProjectUpsertRequest request) {
        CiProject project = CiProject.builder().member(member).build();
        apply(project, request);
        project.setStatus(ProjectStatus.BRIEF_READY);
        project.setCurrentStep(4);
        return ciProjectRepository.save(project);
    }

    public CiProjectResponse toResponse(CiProject p) {
        return new CiProjectResponse(p.getPublicId(), p.getStatus(), p.getCurrentStep(), p.getIndustry(),
                p.getCompanyName(), p.getCoreValues(), p.getTone(), p.colorList(), p.getLogoStyle(),
                p.getAdditionalRequirements(), p.getCreatedAt(), p.getUpdatedAt());
    }

    private void apply(CiProject p, CiProjectUpsertRequest r) {
        if (r == null) return;
        if (r.industry() != null) p.setIndustry(r.industry());
        if (r.companyName() != null) p.setCompanyName(r.companyName());
        if (r.coreValues() != null) p.setCoreValues(r.coreValues());
        if (r.tone() != null) p.setTone(r.tone());
        if (r.color1() != null) p.setColor1(r.color1());
        if (r.color2() != null) p.setColor2(r.color2());
        if (r.color3() != null) p.setColor3(r.color3());
        if (r.color4() != null) p.setColor4(r.color4());
        if (r.logoStyle() != null) p.setLogoStyle(r.logoStyle());
        if (r.additionalRequirements() != null) p.setAdditionalRequirements(r.additionalRequirements());
        if (hasBrief(p)) p.setStatus(ProjectStatus.BRIEF_READY);
    }

    private boolean hasBrief(CiProject p) {
        return p.getCompanyName() != null && !p.getCompanyName().isBlank()
                && p.getIndustry() != null && !p.getIndustry().isBlank();
    }
}
