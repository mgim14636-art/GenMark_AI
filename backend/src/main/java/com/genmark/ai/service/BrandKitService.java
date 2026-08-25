package com.genmark.ai.service;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
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

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.imageio.ImageIO;

/**
 * 브랜드킷 (F14). 사용자가 명함 또는 제품 썸네일 이미지를 선택해 만든다.
 *
 * <p>킷 종류가 없을 때만 기존 호환 규칙(CI는 명함, BI는 제품 썸네일)을 적용한다.
 *
 * <p>AI 서버가 돌려준 임시 결과 여부와 경고도 함께 저장해 화면이 품질 상태를 구분할 수 있게 한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BrandKitService {
    private static final String THUMBNAIL_RENDERER_VERSION = "product-mockup-single-v1";
    private static final ObjectMapper CANONICAL_JSON = new ObjectMapper()
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

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

        BrandKit.KitType kitType = resolveKitType(request, isCi);
        BusinessCardInfo requestedCardInfo = kitType == BrandKit.KitType.BUSINESS_CARD
                ? toBusinessCardInfo(requireCardInfo(request)) : null;
        String renderSpecJson = renderSpecJson(kitType, requestedCardInfo, project.toSurvey());
        String renderSpecHash = sha256(renderSpecJson);

        BrandKit done = brandKitRepository
                .findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                        candidate.getId(), kitType, renderSpecHash, BrandKit.Status.SUCCEEDED)
                .orElse(null);
        if (done != null && isReusable(done, candidate)) return toResponse(done);

        BrandKit kit = BrandKit.builder()
                .candidate(candidate)
                .kitType(kitType)
                .status(BrandKit.Status.QUEUED)
                .renderSpecJson(renderSpecJson)
                .renderSpecHash(renderSpecHash)
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
            byte[] thumbnailPng = null;
            for (int index = 0; index < expectedCount; index += 1) {
                String entryName = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD
                        ? (index == 0 ? "front.png" : "back.png")
                        : "thumbnail.png";
                byte[] imageBytes = storage.read(storageKeys.get(index));
                if (index == 0 && kit.getKitType() != BrandKit.KitType.BUSINESS_CARD) thumbnailPng = imageBytes;
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(imageBytes);
                zip.closeEntry();
            }
            if (kit.getKitType() == BrandKit.KitType.BUSINESS_CARD) {
                for (int index = 0; index < expectedCount; index += 1) {
                    var printAsset = storage.readBrandKitPrintAsset(kit.getPublicId(), index + 1);
                    if (printAsset.isEmpty()) continue; // legacy PNG-only brand kits remain downloadable
                    String side = index == 0 ? "front" : "back";
                    zip.putNextEntry(new ZipEntry(side + ".svg"));
                    zip.write(printAsset.get().svg());
                    zip.closeEntry();
                    zip.putNextEntry(new ZipEntry(side + ".pdf"));
                    zip.write(printAsset.get().pdf());
                    zip.closeEntry();
                }
            } else {
                // 제품 썸네일은 사진 합성 결과라 별도의 벡터 원본이 없다.
                // 같은 사진을 SVG 컨테이너에 담아 PNG와 동일한 화면을 SVG로도 받을 수 있게 한다.
                zip.putNextEntry(new ZipEntry("thumbnail.svg"));
                zip.write(wrapPngAsSvg(thumbnailPng));
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

    /**
     * 제품 썸네일은 사진 합성 결과라 벡터 원본이 없다. PNG를 그대로 SVG의 {@code <image>}
     * 태그에 담아, PNG와 화면상 완전히 같은 내용을 SVG 파일로도 내려받을 수 있게 한다.
     */
    private byte[] wrapPngAsSvg(byte[] pngBytes) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(pngBytes));
        if (image == null) throw new ApiException(ErrorCode.STORAGE_ERROR);
        int width = image.getWidth();
        int height = image.getHeight();
        String base64Png = Base64.getEncoder().encodeToString(pngBytes);
        String svg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height
                + "\" viewBox=\"0 0 " + width + " " + height + "\">"
                + "<image width=\"" + width + "\" height=\"" + height
                + "\" href=\"data:image/png;base64," + base64Png + "\"/></svg>";
        return svg.getBytes(StandardCharsets.UTF_8);
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

    /** 마이페이지에서 사용자가 만든 완료된 브랜드 키트를 삭제한다. */
    @Transactional
    public void delete(String projectId, String candidateId, String brandKitId, Long memberId) {
        projectLookup.requireOwned(projectId, memberId);
        BrandKit kit = requireOwned(brandKitId, memberId);
        ProjectLike project = kit.getCandidate().getGeneration().getProject();
        if (!project.getPublicId().equals(projectId)
                || !kit.getCandidate().getPublicId().equals(candidateId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        if (kit.getStatus() == BrandKit.Status.QUEUED || kit.getStatus() == BrandKit.Status.RUNNING) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "생성 중인 브랜드 키트는 삭제할 수 없습니다.");
        }
        storage.deleteBrandKitArtifacts(kit.getPublicId(), kit.getStorageKey());
        brandKitRepository.delete(kit);
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

    private boolean isReusable(BrandKit kit, LogoCandidate candidate) {
        int expectedImageCount = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD ? 2 : 1;
        return !kit.isPreliminary()
                && storage.brandKitSourceKeyMatches(kit.getPublicId(), candidate.getStorageKey())
                && storage.brandKitHasExpectedImageCount(kit.getPublicId(), expectedImageCount);
    }

    private BusinessCardInfoRequest requireCardInfo(BrandKitCreateRequest request) {
        if (request == null || request.cardInfo() == null
                || request.cardInfo().name() == null || request.cardInfo().name().isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "명함에 표시할 이름을 입력해 주세요.");
        }
        return request.cardInfo();
    }

    private BrandKit.KitType resolveKitType(BrandKitCreateRequest request, boolean isCi) {
        if (request == null || request.kitType() == null || request.kitType().isBlank()) {
            return isCi ? BrandKit.KitType.BUSINESS_CARD : BrandKit.KitType.THUMBNAIL;
        }
        try {
            return BrandKit.KitType.valueOf(request.kitType().trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "지원하지 않는 브랜드 키트 종류입니다.");
        }
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

    private String renderSpecJson(BrandKit.KitType kitType, BusinessCardInfo info,
                                  Map<String, Object> survey) {
        Map<String, Object> spec = new TreeMap<>();
        spec.put("kit_type", kitType.name());
        if (kitType == BrandKit.KitType.THUMBNAIL) {
            spec.put("renderer_version", THUMBNAIL_RENDERER_VERSION);
        }
        spec.put("survey", snakeCase(survey));
        if (info != null) {
            Map<String, Object> cardInfo = new TreeMap<>();
            cardInfo.put("address", info.getAddress()); cardInfo.put("company", info.getCompany());
            cardInfo.put("email", info.getEmail()); cardInfo.put("name", info.getName());
            cardInfo.put("phone", info.getPhone()); cardInfo.put("title", info.getTitle());
            spec.put("card_info", cardInfo);
        }
        try {
            return CANONICAL_JSON.writeValueAsString(spec);
        } catch (Exception ex) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "브랜드 키트 렌더 설정을 저장할 수 없습니다.");
        }
    }

    private String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(64);
            for (byte b : hash) out.append(String.format("%02x", b));
            return out.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
    }

    @SuppressWarnings("unchecked")
    private Object snakeCase(Object value) {
        if (value instanceof Map<?, ?> raw) {
            Map<String, Object> result = new TreeMap<>();
            raw.forEach((key, child) -> result.put(toSnake(String.valueOf(key)), snakeCase(child)));
            return result;
        }
        if (value instanceof List<?> values) return values.stream().map(this::snakeCase).toList();
        return value;
    }

    private String toSnake(String value) {
        return value.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
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
                kit.isPreliminary(),
                kit.getWarnings(),
                kit.getErrorCode(),
                kit.getErrorMessage(),
                kit.getStartedAt(),
                kit.getCompletedAt(),
                kit.getCreatedAt());
    }

    public record BrandKitArchive(String filename, byte[] bytes) {}
}
