package com.genmark.ai.service;

import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.dto.admin.AdminDashboardResponse;
import com.genmark.ai.web.dto.admin.AdminDownloadRow;
import com.genmark.ai.web.dto.admin.AdminMemberRow;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 관리자 화면 3종(대시보드 / 회원관리 / 통계)에 필요한 집계를 담당한다.
 *
 * <p>집계 단위가 항목마다 다르다는 점에 주의한다.
 * <ul>
 *   <li>생성 건수: 로고 4개 한 묶음이 1건. logo_generations 행 하나가 곧 1건이다</li>
 *   <li>다운로드 횟수: 로고 1개당 1회. 같은 로고를 또 받아도 logo_downloads에 행이
 *       늘지 않으므로(UNIQUE 제약) 그대로 세면 된다</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    private final MemberRepository memberRepository;
    private final LogoGenerationRepository generationRepository;
    private final LogoDownloadRepository downloadRepository;
    private final MemberOnboardingRepository onboardingRepository;

    public AdminDashboardResponse dashboard() {
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        long totalMembers = memberRepository.count();
        long newMembers = memberRepository.findAll().stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt().isAfter(weekAgo))
                .count();
        return new AdminDashboardResponse(
                totalMembers,
                newMembers,
                // 실패한 생성은 건수에서 뺀다. 사용자에게 결과가 나가지 않았기 때문이다.
                generationRepository.countByStatus(LogoGeneration.Status.SUCCEEDED),
                downloadRepository.count());
    }

    public List<AdminMemberRow> members() {
        return memberRepository.findAll().stream().map(this::toRow).toList();
    }

    /** 통계 화면: 특정 회원이 받은 CI 또는 BI 로고 목록. */
    public List<AdminDownloadRow> downloadsOf(Long memberId, LogoDownload.ProjectType projectType) {
        if (!memberRepository.existsById(memberId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "존재하지 않는 회원입니다.");
        }
        return downloadRepository
                .findByMemberIdAndProjectTypeOrderByDownloadedAtDesc(memberId, projectType)
                .stream()
                .map(d -> new AdminDownloadRow(
                        d.getId(),
                        d.getCandidate().getPublicId(),
                        d.getProjectType().name(),
                        "/api/v1/admin/downloads/" + d.getId() + "/image",
                        d.getDownloadedAt()))
                .toList();
    }

    private AdminMemberRow toRow(Member member) {
        // member_onboardings의 PK가 member_id라 회원당 최대 한 행만 있다 — 그 행이 있으면 작성 완료.
        MemberOnboarding onboarding = onboardingRepository.findById(member.getId()).orElse(null);
        List<String> onboardingUsage = new ArrayList<>();
        if (onboarding != null) {
            if (onboarding.getUsage1() != null) onboardingUsage.add(onboarding.getUsage1());
            if (onboarding.getUsage2() != null) onboardingUsage.add(onboarding.getUsage2());
            if (onboarding.getUsage3() != null) onboardingUsage.add(onboarding.getUsage3());
        }
        return new AdminMemberRow(
                member.getId(),
                member.getEmail(),
                member.getName(),
                member.getProvider(),
                generationRepository.countByCiProjectMemberIdAndStatus(member.getId(), LogoGeneration.Status.SUCCEEDED),
                generationRepository.countByBiProjectMemberIdAndStatus(member.getId(), LogoGeneration.Status.SUCCEEDED),
                downloadRepository.countByMemberId(member.getId()),
                member.getCreditBalance(),
                // 유료 사용자 판단 기준이 아직 정해지지 않았다. 결제 기능이 생기면 그때 실제 값을 넣는다.
                false,
                member.getCreatedAt(),
                onboarding != null,
                onboardingUsage,
                onboarding == null ? null : onboarding.getAudience(),
                onboarding == null ? null : onboarding.getCompletedAt());
    }
}
