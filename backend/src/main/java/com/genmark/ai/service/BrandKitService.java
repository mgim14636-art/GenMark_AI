package com.genmark.ai.service;

import com.genmark.ai.entity.BrandKit;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.BrandKitRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.brandkit.BrandKitResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * 브랜드킷 (F14). CI는 명함, BI는 로션 병 이미지를 만든다.
 *
 * <p>킷 종류를 사용자가 고르지 않는다. 프로젝트가 CI인지 BI인지에 따라 자동으로 정해진다.
 *
 * <p><b>AI 서버에 브랜드킷 엔드포인트가 아직 없다.</b> 이 코드는 준비만 되어 있고,
 * 실제로 호출하면 AI_UNAVAILABLE로 실패 처리된다. AI 담당자 작업이 끝나야 동작한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BrandKitService {

    private final ProjectLookupService projectLookup;
    private final LogoCandidateRepository candidateRepository;
    private final BrandKitRepository brandKitRepository;
    private final BrandKitWorker worker;

    /**
     * 브랜드킷 생성을 요청한다. 즉시 QUEUED 상태로 돌려주고 실제 생성은 백그라운드에서 진행된다.
     *
     * <p>같은 로고로 이미 성공한 브랜드킷이 있으면 그것을 그대로 돌려준다. AI 호출은 비싸고
     * 결과도 같을 것이므로 다시 만들 이유가 없다.
     */
    @Transactional
    public BrandKitResponse create(String projectId, String candidateId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;

        LogoCandidate candidate = (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                        candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
                        candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        // CI면 명함, BI면 로션 병. 사용자가 선택하는 값이 아니다.
        BrandKit.KitType kitType = isCi ? BrandKit.KitType.BUSINESS_CARD : BrandKit.KitType.BOTTLE;

        BrandKit done = brandKitRepository
                .findFirstByCandidateIdAndKitTypeAndStatusOrderByCompletedAtDesc(
                        candidate.getId(), kitType, BrandKit.Status.SUCCEEDED)
                .orElse(null);
        if (done != null) return toResponse(done);

        BrandKit kit = brandKitRepository.save(BrandKit.builder()
                .candidate(candidate)
                .kitType(kitType)
                .status(BrandKit.Status.QUEUED)
                .build());

        runAfterCommit(() -> worker.execute(kit.getId()));
        return toResponse(kit);
    }

    public BrandKitResponse get(String projectId, String brandKitId, Long memberId) {
        projectLookup.requireOwned(projectId, memberId);
        return toResponse(requireOwned(brandKitId, memberId));
    }

    public List<BrandKitResponse> list(String projectId, String candidateId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;
        LogoCandidate candidate = (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                        candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
                        candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        return brandKitRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId())
                .stream().map(this::toResponse).toList();
    }

    private BrandKit requireOwned(String brandKitId, Long memberId) {
        BrandKit kit = brandKitRepository.findByPublicId(brandKitId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        ProjectLike owner = kit.getCandidate().getGeneration().getProject();
        if (!owner.getMember().getId().equals(memberId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return kit;
    }

    private void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { task.run(); }
            });
        } else {
            task.run();
        }
    }

    private BrandKitResponse toResponse(BrandKit kit) {
        return new BrandKitResponse(
                kit.getPublicId(),
                kit.getCandidate().getPublicId(),
                kit.getKitType().name(),
                kit.getStatus().name(),
                kit.getStorageKey(),
                kit.getErrorCode(),
                kit.getErrorMessage(),
                kit.getStartedAt(),
                kit.getCompletedAt(),
                kit.getCreatedAt());
    }
}
