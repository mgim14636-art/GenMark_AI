package com.genmark.ai.service;

import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.web.dto.project.BiProjectResponse;
import com.genmark.ai.web.dto.project.BiProjectUpsertRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BiProjectService {

    /** brand-brief/target-age/tone/logo-style/final-review page order shown to the user. */
    private static final Map<String, Integer> STEP_ORDER = Map.of(
            "brand-brief", 1, "target-age", 2, "tone", 3, "logo-style", 4, "final-review", 5);

    private final BiProjectRepository biProjectRepository;

    @Transactional
    public BiProjectResponse create(Member member, BiProjectUpsertRequest request) {
        BiProject project = BiProject.builder().member(member).build();
        apply(project, request);
        return toResponse(biProjectRepository.save(project));
    }

    public BiProject requireOwned(String publicId, Long memberId) {
        return biProjectRepository.findByPublicIdAndMemberId(publicId, memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    public BiProjectResponse get(String publicId, Long memberId) {
        return toResponse(requireOwned(publicId, memberId));
    }

    /**
     * 이어쓰기 확인창에서 "아니오"를 선택했을 때 초안을 지운다. 이미 로고 생성이 시작된
     * 프로젝트(GENERATING 이후)는 생성 이력·후보 이미지까지 함께 사라지므로 지우지 않는다.
     */
    @Transactional
    public void delete(String publicId, Long memberId) {
        BiProject project = requireOwned(publicId, memberId);
        if (project.getStatus() != ProjectStatus.DRAFT && project.getStatus() != ProjectStatus.BRIEF_READY) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "이미 생성이 시작된 프로젝트는 삭제할 수 없습니다.");
        }
        biProjectRepository.delete(project);
    }

    @Transactional
    public BiProjectResponse update(String publicId, Long memberId, BiProjectUpsertRequest request) {
        BiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        return toResponse(project);
    }

    /**
     * {@code current_step}에는 방금 제출을 마친 단계 번호가 아니라 <b>그다음에 보여줄 화면 번호</b>(제출한
     * 단계 번호 + 1)를 저장한다. CiProjectService.updateStep()과 같은 이유다.
     */
    @Transactional
    public BiProjectResponse updateStep(String publicId, Long memberId, String step, BiProjectUpsertRequest request) {
        Integer stepNumber = STEP_ORDER.get(step);
        if (stepNumber == null) throw new ApiException(ErrorCode.VALIDATION_ERROR, "알 수 없는 온보딩 단계입니다: " + step);
        BiProject project = requireOwned(publicId, memberId);
        apply(project, request);
        int nextScreenStep = stepNumber + 1;
        if (nextScreenStep > project.getCurrentStep()) project.setCurrentStep(nextScreenStep);
        return toResponse(project);
    }

    @Transactional

    public BiProjectResponse toResponse(BiProject p) {
        List<String> valueCategories = Stream.of(p.getValueCategory1(), p.getValueCategory2(), p.getValueCategory3())
                .filter(Objects::nonNull).toList();
        return new BiProjectResponse(p.getPublicId(), p.getStatus(), p.getCurrentStep(), p.getIndustry(),
                p.getBrandName(), valueCategories, p.getBrandDescription(), p.getTargetAge(), p.getTone(),
                p.colorList(), p.getLogoStyle(), p.getAdditionalRequirements(), p.getCreatedAt(), p.getUpdatedAt());
    }

    private void apply(BiProject p, BiProjectUpsertRequest r) {
        if (r == null) return;
        if (r.industry() != null) p.setIndustry(r.industry());
        if (r.brandName() != null) p.setBrandName(r.brandName());
        if (r.valueCategory1() != null) p.setValueCategory1(r.valueCategory1());
        if (r.valueCategory2() != null) p.setValueCategory2(r.valueCategory2());
        if (r.valueCategory3() != null) p.setValueCategory3(r.valueCategory3());
        if (r.brandDescription() != null) p.setBrandDescription(r.brandDescription());
        if (r.targetAge() != null) p.setTargetAge(r.targetAge());
        if (r.tone() != null) p.setTone(r.tone());
        if (r.color1() != null) p.setColor1(r.color1());
        if (r.color2() != null) p.setColor2(r.color2());
        if (r.color3() != null) p.setColor3(r.color3());
        if (r.color4() != null) p.setColor4(r.color4());
        if (r.logoStyle() != null) p.setLogoStyle(r.logoStyle());
        if (r.additionalRequirements() != null) p.setAdditionalRequirements(r.additionalRequirements());
        if (hasBrief(p)) p.setStatus(ProjectStatus.BRIEF_READY);
    }

    private boolean hasBrief(BiProject p) {
        return p.getBrandName() != null && !p.getBrandName().isBlank()
                && p.getIndustry() != null && !p.getIndustry().isBlank();
    }
}
