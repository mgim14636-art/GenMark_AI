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

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LogoGenerationProcessor {
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
            List<String> logos = result.logos();
            if (!result.success() || logos == null || logos.size() != 4) {
                throw new ApiException(ErrorCode.AI_INCOMPLETE_RESULT);
            }
            List<LogoFileStorage.StoredImage> images = new ArrayList<>(4);
            for (int i = 0; i < 4; i++) {
                images.add(storage.store(generation.getPublicId(), i + 1, logos.get(i)));
            }
            for (int i = 0; i < 4; i++) {
                LogoFileStorage.StoredImage image = images.get(i);
                candidateRepository.save(LogoCandidate.builder().generation(generation).candidateOrder(i + 1)
                        .storageKey(image.storageKey()).mimeType("image/png")
                        .width(image.width()).height(image.height()).build());
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

    private String safeMessage(Exception ex) {
        String message = ex instanceof ApiException ? ex.getMessage() : "AI 서버 호출에 실패했습니다.";
        return message == null ? "AI 서버 호출에 실패했습니다." : message.substring(0, Math.min(message.length(), 1000));
    }
}
