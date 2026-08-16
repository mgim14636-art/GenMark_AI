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
