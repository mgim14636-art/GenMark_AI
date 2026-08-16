package com.genmark.ai.service;

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

/**
 * 브랜드킷 이미지를 실제로 만들어 저장한다. {@link LogoGenerationProcessor}와 같은 흐름이다.
 *
 * <p>QUEUED -> RUNNING -> SUCCEEDED / FAILED 로 상태를 옮기고, 실패하면 error_code와
 * error_message를 남긴다. 비동기라 화면에서는 이 값으로만 실패 이유를 알 수 있다.
 */
@Service
@RequiredArgsConstructor
public class BrandKitProcessor {

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
            var imageBase64Values = brandKitAiClient.generate(buildRequest(kit, sourceStorageKey));
            int expectedImageCount = kit.getKitType() == BrandKit.KitType.BUSINESS_CARD ? 2 : 1;
            if (imageBase64Values.size() != expectedImageCount) {
                throw new IllegalStateException("Brand kit response image count mismatch");
            }
            // 저장 경로는 브랜드킷 public_id 아래에 둔다. 로고 후보와 섞이지 않게 하기 위함이다.
            LogoFileStorage.StoredImage stored = null;
            for (int index = 0; index < imageBase64Values.size(); index += 1) {
                LogoFileStorage.StoredImage current = storage.store(
                        "brand-kits/" + kit.getPublicId(), index + 1, imageBase64Values.get(index));
                if (stored == null) stored = current;
            }
            if (stored == null) throw new IllegalStateException("Brand kit response contains no images");
            storage.storeBrandKitSourceKey(kit.getPublicId(), sourceStorageKey);
            kit.setStorageKey(stored.storageKey());
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
        // 배경·분위기를 잡는 데 쓰라고 프로젝트 입력값을 그대로 넘긴다.
        // (예: 친환경 컨셉이면 제품 썸네일 배경에 풀을 넣는 식)
        request.put("survey", project.toSurvey());
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

    private String safeMessage(Exception ex) {
        String message = ex instanceof ApiException ? ex.getMessage() : "AI 서버 호출에 실패했습니다.";
        return message == null ? "AI 서버 호출에 실패했습니다."
                : message.substring(0, Math.min(message.length(), 1000));
    }
}
