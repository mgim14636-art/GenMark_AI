package com.genmark.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    public byte[] read(String projectId, String candidateId, Long memberId) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        return storage.readPreferredSvg(candidate.getGeneration().getPublicId(), candidate.getCandidateOrder());
    }

    @Transactional
    public void saveEdited(String projectId, String candidateId, Long memberId, String svg) {
        LogoCandidate candidate = requireOwnedCandidate(projectId, candidateId, memberId);
        storage.storeEditedSvg(candidate.getGeneration().getPublicId(), candidate.getCandidateOrder(), svg);
        candidate.setAiMetadataJson(markSvgAvailable(candidate.getAiMetadataJson()));
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

    private String markSvgAvailable(String current) {
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
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
    }
}
