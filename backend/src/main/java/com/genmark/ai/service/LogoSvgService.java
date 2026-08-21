package com.genmark.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.client.SvgRasterizerClient;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LogoSvgService {
    private final ProjectLookupService projectLookup;
    private final LogoCandidateRepository candidateRepository;
    private final LogoFileStorage storage;
    private final SvgRasterizerClient rasterizerClient;
    private final ObjectMapper objectMapper;

    public byte[] read(String projectId, String candidateId, Long memberId) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        return storage.readSvg(candidate.getGeneration().getPublicId(), candidate.getCandidateOrder(),
                svgRevision(candidate.getAiMetadataJson()));
    }

    @Transactional
    public void saveEdited(String projectId, String candidateId, Long memberId, String svg) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        String pngBase64 = rasterizerClient.rasterize(svg);
        LogoFileStorage.StoredEditedAsset stored = storage.storeEditedAssets(
                candidate.getGeneration().getPublicId(), candidate.getCandidateOrder(), svg, pngBase64);
        candidate.setStorageKey(stored.storageKey());
        candidate.setWidth(stored.width());
        candidate.setHeight(stored.height());
        candidate.setAiMetadataJson(markSvgAvailable(candidate.getAiMetadataJson(), stored.revision()));
        candidateRepository.save(candidate);
    }

    /**
     * 편집본을 버리고 AI가 처음 만든 원본 로고로 되돌린다.
     *
     * <p>편집본 파일은 지우지 않는다 — 이 후보가 "지금 무엇을 가리키는지"만 원본 쪽으로
     * 돌려놓는다. 그래서 되돌린 뒤에도 편집 이력 파일은 디스크에 그대로 남는다.
     */
    @Transactional
    public void restoreOriginal(String projectId, String candidateId, Long memberId) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        LogoFileStorage.StoredImage original = storage.originalAsset(
                candidate.getGeneration().getPublicId(), candidate.getCandidateOrder());
        candidate.setStorageKey(original.storageKey());
        candidate.setWidth(original.width());
        candidate.setHeight(original.height());
        candidate.setAiMetadataJson(markSvgRestored(candidate.getAiMetadataJson()));
        candidateRepository.save(candidate);
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

    private String svgRevision(String metadataJson) {
        if (metadataJson == null) return null;
        try {
            Map<String, Object> metadata = objectMapper.readValue(metadataJson, new TypeReference<>() {});
            Object revision = metadata.get("svgRevision");
            return revision instanceof String value && !value.isBlank() ? value : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * svgRevision을 지워 read()가 다시 원본 SVG를 읽게 하고, svgEdited를 false로 되돌린다.
     * svgAvailable은 건드리지 않는다 — 원본 SVG는 여전히 있으므로 편집 기능도 그대로 쓸 수 있다.
     */
    private String markSvgRestored(String current) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (current != null) {
            try {
                metadata.putAll(objectMapper.readValue(current, new TypeReference<>() {}));
            } catch (Exception ignored) {
                // Corrupt optional metadata must not prevent restoring a logo to its original.
            }
        }
        metadata.put("svgEdited", false);
        metadata.remove("svgRevision");
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private String markSvgAvailable(String current, String revision) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (current != null) {
            try {
                metadata.putAll(objectMapper.readValue(current, new TypeReference<>() {}));
            } catch (Exception ignored) {
                // Corrupt optional metadata must not prevent saving a validated SVG edit.
            }
        }
        metadata.put("svgAvailable", true);
        metadata.put("svgEdited", true);
        metadata.put("svgRevision", revision);
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
    }
}
