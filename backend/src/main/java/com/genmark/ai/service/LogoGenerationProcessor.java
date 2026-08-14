package com.genmark.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.client.LogoAiClient;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LogoGenerationProcessor {
    private static final int EXPECTED_LOGO_COUNT = 1;

    private final LogoGenerationRepository generationRepository;
    private final LogoCandidateRepository candidateRepository;
    private final LogoAiClient logoAiClient;
    private final LogoFileStorage storage;
    private final ObjectMapper objectMapper;

    @Transactional
    public void process(Long generationId) {
        LogoGeneration generation = generationRepository.findById(generationId).orElse(null);
        if (generation == null || generation.getStatus() != LogoGeneration.Status.QUEUED) return;
        generation.setStatus(LogoGeneration.Status.RUNNING);
        generation.setStartedAt(LocalDateTime.now());
        try {
            Map<String, Object> survey = objectMapper.readValue(
                    generation.getRequestSnapshotJson(), new TypeReference<>() {});
            LogoAiClient.LogoAiResult result = logoAiClient.generate(survey);
            List<LogoAiClient.GeneratedLogo> logos = result.logos();
            if (!result.success() || logos == null || logos.size() != EXPECTED_LOGO_COUNT) {
                throw new ApiException(ErrorCode.AI_INCOMPLETE_RESULT);
            }
            List<LogoFileStorage.StoredImage> images = new ArrayList<>(EXPECTED_LOGO_COUNT);
            for (int i = 0; i < EXPECTED_LOGO_COUNT; i++) {
                images.add(storage.store(generation.getPublicId(), i + 1, logos.get(i).imageBase64()));
                if (logos.get(i).svg() != null) {
                    storage.storeOriginalSvg(generation.getPublicId(), i + 1, logos.get(i).svg());
                }
            }
            for (int i = 0; i < EXPECTED_LOGO_COUNT; i++) {
                LogoFileStorage.StoredImage image = images.get(i);
                candidateRepository.save(LogoCandidate.builder().generation(generation).candidateOrder(i + 1)
                        .storageKey(image.storageKey()).mimeType("image/png")
                        .width(image.width()).height(image.height())
                        .aiMetadataJson(writeMetadata(logos.get(i)))
                        .build());
            }
            generation.setStatus(LogoGeneration.Status.SUCCEEDED);
            generation.getProject().setStatus(ProjectStatus.RESULT_READY);
            generation.setCompletedAt(LocalDateTime.now());
        } catch (Exception ex) {
            generation.setStatus(LogoGeneration.Status.FAILED);
            generation.getProject().setStatus(ProjectStatus.BRIEF_READY);
            generation.setErrorCode(ex instanceof ApiException api ? api.getErrorCode().name() : ErrorCode.AI_UNAVAILABLE.name());
            generation.setErrorMessage(safeMessage(ex));
            generation.setCompletedAt(LocalDateTime.now());
        }
    }

    /**
     * AI가 이 후보와 함께 돌려준 시드·모티프 번호를 저장해둔다. 재생성(F12-2) 시
     * {@link LogoGenerationService}가 이 값을 근거로 다음 모티프 위치를 계산한다.
     *
     * <p>AI가 값을 안 주면(둘 다 null) 저장할 게 없으므로 null을 돌려주고, 컬럼은
     * 비워둔다. 메타데이터 직렬화 실패가 로고 생성 자체를 실패시켜서는 안 되므로
     * 예외를 던지지 않는다.
     */
    private String writeMetadata(LogoAiClient.GeneratedLogo logo) {
        if (logo.seed() == null && logo.variantIndex() == null && logo.svg() == null) return null;
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (logo.variantIndex() != null) metadata.put("variantIndex", logo.variantIndex());
        if (logo.seed() != null) metadata.put("seed", logo.seed());
        if (logo.svg() != null) metadata.put("svgAvailable", true);
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String safeMessage(Exception ex) {
        String message = ex instanceof ApiException ? ex.getMessage() : "AI 서버 호출에 실패했습니다.";
        return message == null ? "AI 서버 호출에 실패했습니다." : message.substring(0, Math.min(message.length(), 1000));
    }
}
