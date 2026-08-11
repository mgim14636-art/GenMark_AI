package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.logo.PinnedCandidateResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * 찜 (F12-3). 애매하게 마음에 드는 로고를 임시로 보류해두는 기능이다.
 *
 * <p>보관 기간은 3일이며 지나면 {@link PinnedCandidateCleanup}이 자동으로 해제한다.
 *
 * <p>찜은 다운로드와 완전히 다른 상태다. 찜은 "보류"일 뿐이라 파일을 보관하지 않으며
 * 3일 뒤 사라진다. 사용자가 이를 "저장됐다"고 오해하지 않도록 화면 안내가 중요하다.
 */
@Service
@Transactional(readOnly = true)
public class LogoPinService {

    private final ProjectLookupService projectLookup;
    private final LogoCandidateRepository candidateRepository;
    private final long retentionDays;

    public LogoPinService(ProjectLookupService projectLookup,
                          LogoCandidateRepository candidateRepository,
                          @Value("${app.pin.retention-days:3}") long retentionDays) {
        this.projectLookup = projectLookup;
        this.candidateRepository = candidateRepository;
        this.retentionDays = retentionDays;
    }

    /** 찜 등록. 이미 찜한 로고를 다시 찜하면 보관 기간이 지금부터 다시 3일로 연장된다. */
    @Transactional
    public PinnedCandidateResponse pin(String projectId, String candidateId, Long memberId) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        candidate.setPinnedAt(LocalDateTime.now());
        return toResponse(candidate);
    }

    /** 찜 해제. */
    @Transactional
    public void unpin(String projectId, String candidateId, Long memberId) {
        requireOwnedCandidate(projectId, candidateId, memberId).setPinnedAt(null);
    }

    /**
     * 내 찜 목록. CI/BI 양쪽을 모두 모아 최근 찜한 순으로 돌려준다.
     *
     * <p>만료 배치가 1시간 간격으로 돌기 때문에, 이미 3일이 지났지만 아직 정리되지 않은 항목이
     * 섞일 수 있다. 사용자에게는 만료된 것을 보여주면 안 되므로 조회 시점에도 한 번 걸러낸다.
     */
    public List<PinnedCandidateResponse> myPins(Long memberId) {
        LocalDateTime threshold = LocalDateTime.now().minusDays(retentionDays);
        return Stream.concat(
                        candidateRepository
                                .findByGenerationCiProjectMemberIdAndPinnedAtIsNotNullOrderByPinnedAtDesc(memberId).stream(),
                        candidateRepository
                                .findByGenerationBiProjectMemberIdAndPinnedAtIsNotNullOrderByPinnedAtDesc(memberId).stream())
                .filter(c -> c.getPinnedAt().isAfter(threshold))
                .sorted(Comparator.comparing(LogoCandidate::getPinnedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    private LogoCandidate requireOwnedCandidate(String projectId, String candidateId, Long memberId) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;
        return (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                        candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
                        candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    private PinnedCandidateResponse toResponse(LogoCandidate candidate) {
        LocalDateTime pinnedAt = candidate.getPinnedAt();
        return new PinnedCandidateResponse(
                candidate.getPublicId(),
                candidate.getStorageKey(),
                pinnedAt,
                // 화면에 "n일 뒤 사라져요"를 표시할 수 있도록 만료 시각을 함께 내려준다
                pinnedAt == null ? null : pinnedAt.plusDays(retentionDays));
    }
}
