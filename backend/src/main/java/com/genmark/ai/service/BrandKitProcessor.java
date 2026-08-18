package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.client.BrandKitAiClient;
import com.genmark.ai.entity.BrandKit;
import com.genmark.ai.entity.BusinessCardInfo;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.BrandKitRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.nio.charset.StandardCharsets;

/**
 * 브랜드킷 이미지를 실제로 만들어 저장한다. {@link LogoGenerationProcessor}와 같은 흐름이다.
 *
 * <p>QUEUED -> RUNNING -> SUCCEEDED / FAILED 로 상태를 옮기고, 실패하면 error_code와
 * error_message를 남긴다. 비동기라 화면에서는 이 값으로만 실패 이유를 알 수 있다.
 */
@Service
@RequiredArgsConstructor
public class BrandKitProcessor {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final BrandKitRepository brandKitRepository;
    private final BrandKitAiClient brandKitAiClient;
    private final LogoFileStorage storage;

    @Transactional
    public void process(Long brandKitId) {
        BrandKit kit = brandKitRepository.findById(brandKitId).orElse(null);
        if (kit == null || kit.getStatus() != BrandKit.Status.QUEUED) return;

        kit.setStatus(BrandKit.Status.RUNNING);
        kit.setStartedAt(LocalDateTime.now());
        try {
            String sourceStorageKey = kit.getCandidate().getStorageKey();
            BrandKitAiClient.Result result = brandKitAiClient.generate(buildRequest(kit, sourceStorageKey));
            var imageBase64Values = result.imageBase64Values();
            int expectedImageCount = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD ? 2 : 1;
            if (imageBase64Values.size() != expectedImageCount) {
                throw new IllegalStateException("Brand kit response image count mismatch");
            }
            if (kit.getKitType() == BrandKit.KitType.BUSINESS_CARD
                    && !hasCompletePrintAssets(result, expectedImageCount)) {
                throw new ApiException(ErrorCode.AI_INVALID_RESPONSE,
                        "명함 SVG/PDF 앞·뒷면이 모두 생성되지 않았습니다.");
            }
            // 저장 경로는 브랜드킷 public_id 아래에 둔다. 로고 후보와 섞이지 않게 하기 위함이다.
            LogoFileStorage.StoredImage stored = null;
            for (int index = 0; index < imageBase64Values.size(); index += 1) {
                LogoFileStorage.StoredImage current = storage.store(
                        "brand-kits/" + kit.getPublicId(), index + 1, imageBase64Values.get(index));
                if (stored == null) stored = current;
            }
            if (kit.getKitType() == BrandKit.KitType.BUSINESS_CARD) {
                for (int index = 0; index < Math.min(result.printAssets().size(), expectedImageCount); index += 1) {
                    BrandKitAiClient.PrintAsset asset = result.printAssets().get(index);
                    if (asset.svgBase64() != null && !asset.svgBase64().isBlank()
                            && asset.pdfBase64() != null && !asset.pdfBase64().isBlank()) {
                        storage.storeBrandKitPrintAsset(
                                kit.getPublicId(), index + 1, asset.svgBase64(), asset.pdfBase64());
                    }
                }
            }
            if (stored == null) throw new IllegalStateException("Brand kit response contains no images");
            storage.storeBrandKitSourceKey(kit.getPublicId(), sourceStorageKey);
            kit.setStorageKey(stored.storageKey());
            kit.setPreliminary(result.preliminary());
            kit.setWarnings(result.warnings());
            kit.setStatus(BrandKit.Status.SUCCEEDED);
            kit.setCompletedAt(LocalDateTime.now());
        } catch (Exception ex) {
            kit.setStatus(BrandKit.Status.FAILED);
            kit.setErrorCode(ex instanceof ApiException api ? api.getErrorCode().name() : ErrorCode.AI_UNAVAILABLE.name());
            kit.setErrorMessage(safeMessage(ex));
            kit.setCompletedAt(LocalDateTime.now());
        }
    }

    /**
     * AI 서버로 보낼 요청 본문.
     *
     * <p>형식은 AI 담당자와 합의되지 않았다. 지금은 "로고 이미지 + 킷 종류 + 브랜드 컨셉"이라는
     * 최소 정보만 담아 두었고, 합의 후 이 메서드만 고치면 된다.
     */
    private Map<String, Object> buildRequest(BrandKit kit, String sourceStorageKey) {
        LogoCandidate candidate = kit.getCandidate();
        ProjectLike project = candidate.getGeneration().getProject();

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("kit_type", kit.getKitType().name());
        byte[] logoPng = storage.read(sourceStorageKey);
        request.put("logo_image_base64", Base64.getEncoder().encodeToString(logoPng));
        try {
            byte[] logoSvg = storage.readSvg(
                    candidate.getGeneration().getPublicId(), candidate.getCandidateOrder(),
                    svgRevision(candidate.getAiMetadataJson()));
            if (logoSvg != null && logoSvg.length > 0) {
                request.put("logo_svg", new String(logoSvg, StandardCharsets.UTF_8));
            }
        } catch (ApiException ex) {
            if (ex.getErrorCode() != ErrorCode.RESOURCE_NOT_FOUND) throw ex;
        }
        Map<String, Object> renderSpec = readRenderSpec(kit.getRenderSpecJson());
        // 생성 요청 시점에 저장한 설문 스냅샷을 사용해야 캐시 해시와 실제 렌더 입력이 일치한다.
        Object survey = renderSpec.get("survey");
        request.put("survey", survey instanceof Map<?, ?> ? survey : project.toSurvey());
        request.put("ci_bi", project instanceof CiProject ? "CI" : "BI");
        BusinessCardInfo info = kit.getBusinessCardInfo();
        if (kit.getKitType() == BrandKit.KitType.BUSINESS_CARD && info != null) {
            Map<String, Object> cardInfo = new LinkedHashMap<>();
            cardInfo.put("name", info.getName());
            cardInfo.put("title", info.getTitle());
            cardInfo.put("company", info.getCompany());
            cardInfo.put("phone", info.getPhone());
            cardInfo.put("email", info.getEmail());
            cardInfo.put("address", info.getAddress());
            request.put("card_info", cardInfo);
        }
        return request;
    }

    private boolean hasCompletePrintAssets(BrandKitAiClient.Result result, int expectedCount) {
        if (result.printAssets().size() != expectedCount) return false;
        return result.printAssets().stream().allMatch(asset -> asset != null
                && asset.svgBase64() != null && !asset.svgBase64().isBlank()
                && asset.pdfBase64() != null && !asset.pdfBase64().isBlank());
    }

    @SuppressWarnings("unchecked")
    private String svgRevision(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) return null;
        try {
            Object revision = JSON.readValue(metadataJson, Map.class).get("svgRevision");
            return revision instanceof String value && value.matches("[0-9a-f]{64}") ? value : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readRenderSpec(String renderSpecJson) {
        if (renderSpecJson == null || renderSpecJson.isBlank()) return Map.of();
        try {
            return JSON.readValue(renderSpecJson, Map.class);
        } catch (Exception ex) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "저장된 렌더 설정을 읽을 수 없습니다.");
        }
    }

    private String safeMessage(Exception ex) {
        String message = ex instanceof ApiException ? ex.getMessage() : "AI 서버 호출에 실패했습니다.";
        return message == null ? "AI 서버 호출에 실패했습니다."
                : message.substring(0, Math.min(message.length(), 1000));
    }
}
