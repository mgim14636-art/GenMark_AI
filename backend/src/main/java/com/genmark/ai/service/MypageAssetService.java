package com.genmark.ai.service;

import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MypageHiddenLogoAsset;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MypageHiddenLogoAssetRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 마이페이지에서만 적용되는 자산 목록 상태를 관리한다. 원본 프로젝트 데이터는 지우지 않는다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MypageAssetService {
    private final LogoCandidateRepository candidateRepository;
    private final MypageHiddenLogoAssetRepository hiddenLogoRepository;
    private final MemberRepository memberRepository;

    public List<String> hiddenLogoCandidateIds(Long memberId) {
        return hiddenLogoRepository.findByMemberIdOrderByHiddenAtDesc(memberId).stream()
                .map(asset -> asset.getCandidate().getPublicId())
                .toList();
    }

    @Transactional
    public void hideLogo(String candidateId, Long memberId) {
        LogoCandidate candidate = candidateRepository.findByPublicIdAndGenerationCiProjectMemberId(candidateId, memberId)
                .or(() -> candidateRepository.findByPublicIdAndGenerationBiProjectMemberId(candidateId, memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (candidate.getGeneration().getStatus() != LogoGeneration.Status.SUCCEEDED) {
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "완료된 생성 작업의 로고만 삭제할 수 있습니다.");
        }
        if (hiddenLogoRepository.existsByMemberIdAndCandidateId(memberId, candidate.getId())) return;

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));
        hiddenLogoRepository.save(MypageHiddenLogoAsset.builder()
                .member(member)
                .candidate(candidate)
                .build());
    }
}
