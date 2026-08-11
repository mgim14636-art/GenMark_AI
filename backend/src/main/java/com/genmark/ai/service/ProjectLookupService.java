package com.genmark.ai.service;

import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A projectId in the shared /api/v1/projects/{projectId}/... routes (logo-generations,
 * trademark-analyses) may belong to either CI_PROJECT or BI_PROJECT. This tries CI first,
 * then BI, so callers that don't care which type it is can work with ProjectLike directly.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectLookupService {
    private final CiProjectRepository ciProjectRepository;
    private final BiProjectRepository biProjectRepository;

    public ProjectLike requireOwned(String publicId, Long memberId) {
        return ciProjectRepository.findByPublicIdAndMemberId(publicId, memberId)
                .<ProjectLike>map(p -> p)
                .or(() -> biProjectRepository.findByPublicIdAndMemberId(publicId, memberId).map(p -> p))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }
}
