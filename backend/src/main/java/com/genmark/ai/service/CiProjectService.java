package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.web.dto.project.CiLatestProfileResponse;
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

    /**
     * 이어쓰기 확인창에서 "아니오"를 선택했을 때 초안을 지운다. 이미 로고 생성이 시작된
     * 프로젝트(GENERATING 이후)는 생성 이력·후보 이미지까지 함께 사라지므로 지우지 않는다.
     */
    @Transactional
    public void delete(String publicId, Long memberId) {
        CiProject project = requireOwned(publicId, memberId);
        if (project.getStatus() != ProjectStatus.DRAFT && project.getStatus() != ProjectStatus.BRIEF_READY) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "이미 생성이 시작된 프로젝트는 삭제할 수 없습니다.");
        }
        ciProjectRepository.delete(project);
    }

    /**
     * 두 번째 CI부터 회사명·핵심가치를 자동으로 채워주기 위한 조회 (F7-1).
     *
     * <p>새 컬럼 없이 "가장 최근 CI 한 건"을 읽는 것만으로 해결된다. BI는 이 규칙이 없어
     * 대응하는 메서드를 두지 않는다.
     *
     * <p>회사명이 비어 있는 CI(작성 중 이탈 등)는 자동 채움 대상이 아니므로 건너뛴다.
     */
    public CiLatestProfileResponse latestProfile(Long memberId) {
        return ciProjectRepository.findFirstByMemberIdOrderByCreatedAtDesc(memberId)
                .filter(p -> p.getCompanyName() != null && !p.getCompanyName().isBlank())
                .map(p -> new CiLatestProfileResponse(true, p.getCompanyName(), p.getCoreValues()))
                .orElseGet(CiLatestProfileResponse::empty);
    }

    @Transactional
    public CiProjectResponse update(String publicId, Long memberId, CiProjectUpsertRequest request) {
        CiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        return toResponse(project);
    }

    /**
     * {@code current_step}에는 방금 제출을 마친 단계 번호가 아니라 <b>그다음에 보여줄 화면 번호</b>(제출한
     * 단계 번호 + 1)를 저장한다.
     *
     * <p>예를 들어 {@code tone}(2) 단계를 제출하면 화면은 이미 {@code logo-style}(3) 화면으로 넘어가
     * 있으므로, 이어쓰기 시 다시 봐야 할 화면도 3이어야 한다. 제출한 번호(2)를 그대로 저장하면 이어쓰기가
     * 사용자가 이미 지나간 화면으로 한 단계 되돌아가는 문제가 생긴다.
     */
    @Transactional
    public CiProjectResponse updateStep(String publicId, Long memberId, String step, CiProjectUpsertRequest request) {
        Integer stepNumber = STEP_ORDER.get(step);
        if (stepNumber == null) throw new ApiException(ErrorCode.VALIDATION_ERROR, "알 수 없는 온보딩 단계입니다: " + step);
        CiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        int nextScreenStep = stepNumber + 1;
        if (nextScreenStep > project.getCurrentStep()) project.setCurrentStep(nextScreenStep);
        return toResponse(project);
    }

    public CiProjectResponse toResponse(CiProject p) {
        return new CiProjectResponse(p.getPublicId(), p.getStatus(), p.getCurrentStep(), p.getIndustry(),
                p.getCompanyName(), p.getCoreValues(), p.getTone(), p.getColorMode(), p.colorList(), p.getLogoStyle(),
                p.getLogoShape(), p.getAdditionalRequirements(), p.getCreatedAt(), p.getUpdatedAt());
    }

    private void apply(CiProject p, CiProjectUpsertRequest r) {
        if (r == null) return;
        if (r.industry() != null) p.setIndustry(r.industry());
        if (r.companyName() != null) p.setCompanyName(r.companyName());
        if (r.coreValues() != null) p.setCoreValues(r.coreValues());
        if (r.tone() != null) p.setTone(r.tone());
        if (r.colorMode() != null) p.setColorMode(r.colorMode());
        applyPalette(p, r);
        if (r.logoStyle() != null) p.setLogoStyle(r.logoStyle());
        if (r.additionalRequirements() != null) p.setAdditionalRequirements(r.additionalRequirements());
        if (r.logoShape() != null) {
            String logoShape = r.logoShape().trim();
            p.setLogoShape(logoShape.isEmpty() ? null : logoShape);
            if (logoShape.isEmpty()) p.setAdditionalRequirements(removeLegacyLogoShape(p.getAdditionalRequirements()));
        }
        // DRAFT일 때만 BRIEF_READY로 승격한다. 이미 GENERATING 이후로 넘어간 프로젝트를
        // 나중에 다시 저장(재요청 준비, 자동저장 등)해도 진행 상태가 뒤로 밀리지 않게 한다.
        if (hasBrief(p) && p.getStatus() == ProjectStatus.DRAFT) p.setStatus(ProjectStatus.BRIEF_READY);
    }

    private void applyPalette(CiProject p, CiProjectUpsertRequest r) {
        boolean replacePalette = Boolean.TRUE.equals(r.paletteReplace()) || "TONE".equals(r.colorMode());
        if (!replacePalette) {
            if (r.color1() != null) p.setColor1(r.color1());
            if (r.color2() != null) p.setColor2(r.color2());
            if (r.color3() != null) p.setColor3(r.color3());
            if (r.color4() != null) p.setColor4(r.color4());
            return;
        }

        p.setColor1(r.color1());
        p.setColor2(r.color2());
        p.setColor3(r.color3());
        p.setColor4(r.color4());
        if ("MANUAL".equals(p.getColorMode()) && p.colorList().isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "직접 선택 색상은 한 개 이상 필요합니다.");
        }
    }

    private boolean hasBrief(CiProject p) {
        return p.getCompanyName() != null && !p.getCompanyName().isBlank()
                && p.getIndustry() != null && !p.getIndustry().isBlank();
    }

    private String removeLegacyLogoShape(String requirements) {
        if (requirements == null) return null;
        String cleaned = requirements.replaceAll("(?m)^\\s*로고 형태:\\s*.*(?:\\R|$)", "").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }
}
