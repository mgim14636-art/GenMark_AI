package com.genmark.ai.repository;

import com.genmark.ai.entity.LogoDownload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LogoDownloadRepository extends JpaRepository<LogoDownload, Long> {

    /**
     * 이미 받은 <b>같은 버전</b>인지 확인용. 있으면 새로 만들지 않고 기존 기록을 그대로 쓴다.
     * 로고를 수정한 뒤 받으면 리비전이 달라 새 기록이 만들어진다.
     */
    Optional<LogoDownload> findByMemberIdAndCandidateIdAndAssetRevision(
            Long memberId, Long candidateId, String assetRevision);

    /**
     * 보관 한도(CI 20 / BI 20) 정리를 위해 해당 종류의 기록을 오래된 순으로 가져온다.
     * idx_download_member_type_time 인덱스를 그대로 탄다.
     */
    List<LogoDownload> findByMemberIdAndProjectTypeOrderByDownloadedAtAsc(
            Long memberId, LogoDownload.ProjectType projectType);

    /** 통계 화면: 사용자별 다운로드 목록을 최신순으로. */
    List<LogoDownload> findByMemberIdAndProjectTypeOrderByDownloadedAtDesc(
            Long memberId, LogoDownload.ProjectType projectType);

    /** 관리자 회원관리: 회원별 다운로드 횟수. */
    long countByMemberId(Long memberId);

    long countByMemberIdAndProjectType(Long memberId, LogoDownload.ProjectType projectType);
}
