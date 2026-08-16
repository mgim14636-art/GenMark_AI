package com.genmark.ai.service;

import com.genmark.ai.entity.BrandKit;
import com.genmark.ai.entity.BusinessCardInfo;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.BrandKitRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.brandkit.BrandKitResponse;
import com.genmark.ai.web.dto.brandkit.BrandKitCreateRequest;
import com.genmark.ai.web.dto.brandkit.BusinessCardInfoRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 브랜드킷 (F14). CI는 명함, BI는 제품 썸네일 이미지를 만든다.
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
    private final LogoFileStorage storage;

    /**
     * 브랜드킷 생성을 요청한다. 즉시 QUEUED 상태로 돌려주고 실제 생성은 백그라운드에서 진행된다.
     *
     * <p>같은 로고로 이미 성공한 브랜드킷이 있으면 그것을 그대로 돌려준다. AI 호출은 비싸고
     * 결과도 같을 것이므로 다시 만들 이유가 없다.
     */
    @Transactional
    public BrandKitResponse create(String projectId, String candidateId, Long memberId,
                                   BrandKitCreateRequest request) {
        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;

        LogoCandidate candidate = (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                        candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
                        candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        // CI면 명함, BI면 제품 썸네일. 사용자가 선택하는 값이 아니다.
        BrandKit.KitType kitType = isCi ? BrandKit.KitType.BUSINESS_CARD : BrandKit.KitType.THUMBNAIL;
        BusinessCardInfo requestedCardInfo = isCi ? toBusinessCardInfo(requireCardInfo(request)) : null;

        BrandKit done = brandKitRepository
                .findFirstByCandidateIdAndKitTypeAndStatusOrderByCompletedAtDesc(
                        candidate.getId(), kitType, BrandKit.Status.SUCCEEDED)
                .orElse(null);
        if (done != null && isReusable(done, candidate, requestedCardInfo)) return toResponse(done);

        BrandKit kit = BrandKit.builder()
                .candidate(candidate)
                .kitType(kitType)
                .status(BrandKit.Status.QUEUED)
                .build();
        if (requestedCardInfo != null) kit.setBusinessCardInfo(requestedCardInfo);
        BrandKit savedKit = brandKitRepository.save(kit);

        runAfterCommit(() -> worker.execute(savedKit.getId()));
        return toResponse(savedKit);
    }

    public BrandKitResponse get(String projectId, String candidateId, String brandKitId, Long memberId) {
        projectLookup.requireOwned(projectId, memberId);
        BrandKit kit = requireOwned(brandKitId, memberId);
        ProjectLike project = kit.getCandidate().getGeneration().getProject();
        if (!project.getPublicId().equals(projectId) || !kit.getCandidate().getPublicId().equals(candidateId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return toResponse(kit);
    }

    public BrandKitArchive downloadArchive(String projectId, String candidateId, String brandKitId,
                                           Long memberId) {
        projectLookup.requireOwned(projectId, memberId);
        BrandKit kit = requireOwned(brandKitId, memberId);
        ProjectLike project = kit.getCandidate().getGeneration().getProject();
        if (!project.getPublicId().equals(projectId)
                || !kit.getCandidate().getPublicId().equals(candidateId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        if (kit.getStatus() != BrandKit.Status.SUCCEEDED) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "완성된 브랜드 키트만 다운로드할 수 있습니다.");
        }

        List<String> storageKeys = storage.brandKitStorageKeys(kit.getPublicId(), kit.getStorageKey());
        int expectedCount = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD ? 2 : 1;
        if (storageKeys.size() < expectedCount) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "브랜드 키트 이미지가 모두 준비되지 않았습니다.");
        }

        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(bytes)) {
            for (int index = 0; index < expectedCount; index += 1) {
                String entryName = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD
                        ? (index == 0 ? "front.png" : "back.png")
                        : "thumbnail.png";
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(storage.read(storageKeys.get(index)));
                zip.closeEntry();
            }
            zip.finish();
            String filename = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD
                    ? "genmark-business-card.zip"
                    : "genmark-thumbnail.zip";
            return new BrandKitArchive(filename, bytes.toByteArray());
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
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

    public List<BrandKitResponse> listForMember(Long memberId) {
        return Stream.concat(
                        brandKitRepository.findByCandidateGenerationCiProjectMemberIdOrderByCreatedAtDesc(memberId).stream(),
                        brandKitRepository.findByCandidateGenerationBiProjectMemberIdOrderByCreatedAtDesc(memberId).stream())
                .sorted(Comparator.comparing(BrandKit::getCreatedAt).reversed())
                .map(this::toResponse)
                .toList();
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

    private boolean isReusable(BrandKit kit, LogoCandidate candidate, BusinessCardInfo requestedCardInfo) {
        int expectedImageCount = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD ? 2 : 1;
        return storage.brandKitSourceKeyMatches(kit.getPublicId(), candidate.getStorageKey())
                && storage.brandKitHasExpectedImageCount(kit.getPublicId(), expectedImageCount)
                && (kit.getKitType() != BrandKit.KitType.BUSINESS_CARD
                    || sameCardInfo(kit.getBusinessCardInfo(), requestedCardInfo));
    }

    private BusinessCardInfoRequest requireCardInfo(BrandKitCreateRequest request) {
        if (request == null || request.cardInfo() == null
                || request.cardInfo().name() == null || request.cardInfo().name().isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "명함에 표시할 이름을 입력해 주세요.");
        }
        return request.cardInfo();
    }

    private BusinessCardInfo toBusinessCardInfo(BusinessCardInfoRequest request) {
        return BusinessCardInfo.builder()
                .name(request.name().trim())
                .title(trimToNull(request.title()))
                .company(trimToNull(request.company()))
                .phone(trimToNull(request.phone()))
                .email(trimToNull(request.email()))
                .address(trimToNull(request.address()))
                .build();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean sameCardInfo(BusinessCardInfo saved, BusinessCardInfo requested) {
        return saved != null && requested != null
                && Objects.equals(saved.getName(), requested.getName())
                && Objects.equals(saved.getTitle(), requested.getTitle())
                && Objects.equals(saved.getCompany(), requested.getCompany())
                && Objects.equals(saved.getPhone(), requested.getPhone())
                && Objects.equals(saved.getEmail(), requested.getEmail())
                && Objects.equals(saved.getAddress(), requested.getAddress());
    }

    private BrandKitResponse toResponse(BrandKit kit) {
        return new BrandKitResponse(
                kit.getPublicId(),
                kit.getCandidate().getPublicId(),
                kit.getCandidate().getGeneration().getProject().getPublicId(),
                kit.getKitType().name(),
                kit.getStatus().name(),
                kit.getStorageKey(),
                storage.brandKitStorageKeys(kit.getPublicId(), kit.getStorageKey()),
                kit.getErrorCode(),
                kit.getErrorMessage(),
                kit.getStartedAt(),
                kit.getCompletedAt(),
                kit.getCreatedAt());
    }

    public record BrandKitArchive(String filename, byte[] bytes) {}
}
