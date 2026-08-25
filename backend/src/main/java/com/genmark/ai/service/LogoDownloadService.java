package com.genmark.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.web.dto.logo.LogoDownloadResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 로고 다운로드 (F12-4).
 *
 * <p>핵심 규칙 네 가지.
 * <ul>
 *   <li>설문에 한 번도 응답하지 않은 회원은 다운로드를 받을 수 없다 — 서버가 매 요청마다
 *       확인하므로, 프론트를 조작해도 우회할 수 없다. 한 번이라도 응답하면 그 뒤로는
 *       영원히 막히지 않는다</li>
 *   <li>같은 로고를 두 번 받아도 1회로 집계한다 — logo_downloads의
 *       UNIQUE(member_id, candidate_id)가 보장하므로 여기서는 기존 기록을 찾아 재사용만 한다</li>
 *   <li>다운로드한 로고만 서버에 보관한다 — 받는 순간 downloads/ 로 사본을 만든다</li>
 *   <li>보관 한도는 CI 20개 + BI 20개로 <b>각각</b> 관리한다 — 넘치면 오래된 것부터
 *       DB 행과 이미지 파일을 함께 지운다</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class LogoDownloadService {

    private final ProjectLookupService projectLookup;
    private final LogoCandidateRepository candidateRepository;
    private final LogoDownloadRepository downloadRepository;
    private final MemberRepository memberRepository;
    private final MemberSurveyRepository surveyRepository;
    private final LogoFileStorage fileStorage;
    private final ObjectMapper objectMapper;

    /** 종류별 보관 한도. CI 20개, BI 20개를 각각 센다. */
    private final int retentionLimit;

    public LogoDownloadService(ProjectLookupService projectLookup,
                               LogoCandidateRepository candidateRepository,
                               LogoDownloadRepository downloadRepository,
                               MemberRepository memberRepository,
                               MemberSurveyRepository surveyRepository,
                               LogoFileStorage fileStorage,
                               ObjectMapper objectMapper,
                               @Value("${app.download.retention-per-type:20}") int retentionLimit) {
        this.projectLookup = projectLookup;
        this.candidateRepository = candidateRepository;
        this.downloadRepository = downloadRepository;
        this.memberRepository = memberRepository;
        this.surveyRepository = surveyRepository;
        this.fileStorage = fileStorage;
        this.objectMapper = objectMapper;
        this.retentionLimit = retentionLimit;
    }

    /**
     * 로고 한 장을 다운로드로 기록하고 보관본을 만든다.
     *
     * <p>이미 받은 로고면 새 기록을 만들지 않고 기존 기록을 그대로 돌려준다. 사용자는 파일을
     * 다시 받을 수 있지만 집계상 횟수는 늘지 않는다.
     *
     * @throws ApiException {@link ErrorCode#SURVEY_REQUIRED} 이 회원이 설문에 한 번도
     *         응답하지 않았을 때. 이미 다운로드한 로고를 다시 받으려는 요청도 예외 없이 막는다
     *         — "한 번은 꼭 받는다"는 규칙이 다운로드 이력과 무관하게 적용돼야 하기 때문이다.
     */
    @Transactional
    public LogoDownloadResponse download(String projectId, String candidateId, Long memberId) {
        if (!surveyRepository.existsByMemberId(memberId)) {
            throw new ApiException(ErrorCode.SURVEY_REQUIRED);
        }

        ProjectLike project = projectLookup.requireOwned(projectId, memberId);
        boolean isCi = project instanceof CiProject;

        LogoCandidate candidate = (isCi
                ? candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                        candidateId, project.getId(), memberId)
                : candidateRepository.findByPublicIdAndGenerationBiProjectIdAndGenerationBiProjectMemberId(
                        candidateId, project.getId(), memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        LogoDownload existing = downloadRepository
                .findByMemberIdAndCandidateId(memberId, candidate.getId()).orElse(null);
        if (existing != null) {
            // 보관본은 후보의 "지금" 상태를 반영해야 한다 — 처음 받은 뒤 원본으로 되돌리거나
            // 다시 수정했다면, 재다운로드 시 그 옛날 사본이 아니라 현재 storageKey로 새로 떠야 한다.
            String refreshedKey = fileStorage.archiveForDownload(
                    memberId, candidate.getPublicId(), candidate.getStorageKey());
            existing.setStorageKey(refreshedKey);
            downloadRepository.save(existing);
            return toResponse(existing, false);
        }

        LogoDownload.ProjectType projectType = isCi ? LogoDownload.ProjectType.CI : LogoDownload.ProjectType.BI;
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));

        String archivedKey = fileStorage.archiveForDownload(
                memberId, candidate.getPublicId(), candidate.getStorageKey());

        LogoDownload download = downloadRepository.save(LogoDownload.builder()
                .member(member)
                .candidate(candidate)
                .projectType(projectType)
                .storageKey(archivedKey)
                .build());

        enforceRetentionLimit(memberId, projectType);
        return toResponse(download, true);
    }

    /** 마이페이지에서 사용자가 보관 중인 다운로드 자산을 삭제한다. */
    @Transactional
    public void delete(Long downloadId, Long memberId) {
        LogoDownload download = downloadRepository.findById(downloadId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (!download.getMember().getId().equals(memberId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        fileStorage.deleteQuietly(download.getStorageKey());
        downloadRepository.delete(download);
    }

    /** 다운로드한 로고의 이미지 바이트. 본인 것만 읽을 수 있다. */
    public byte[] readImage(Long downloadId, Long memberId) {
        LogoDownload download = downloadRepository.findById(downloadId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (!download.getMember().getId().equals(memberId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return fileStorage.read(download.getStorageKey());
    }

    /** 관리자 통계 화면에서 쓰는 이미지 조회. 소유자 검사를 하지 않는다. */
    public byte[] readImageAsAdmin(Long downloadId) {
        return fileStorage.read(downloadRepository.findById(downloadId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND))
                .getStorageKey());
    }

    /**
     * 다운로드한 로고를 PNG·SVG 둘 다 담은 zip으로 묶어 돌려준다. 본인 것만 받을 수 있다.
     *
     * <p>SVG가 없는(예전 방식으로 만든) 로고는 PNG만 담아서, 예전 다운로드 기록도 계속
     * 받을 수 있게 한다.
     */
    public LogoDownloadArchive downloadArchive(Long downloadId, Long memberId) {
        LogoDownload download = downloadRepository.findById(downloadId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (!download.getMember().getId().equals(memberId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        LogoCandidate candidate = download.getCandidate();

        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("logo.png"));
            zip.write(fileStorage.read(download.getStorageKey()));
            zip.closeEntry();

            try {
                byte[] svg = fileStorage.readSvg(candidate.getGeneration().getPublicId(),
                        candidate.getCandidateOrder(), svgRevision(candidate.getAiMetadataJson()));
                zip.putNextEntry(new ZipEntry("logo.svg"));
                zip.write(svg);
                zip.closeEntry();
            } catch (ApiException ignored) {
                // 벡터 원본이 없는 예전 다운로드는 PNG만 담아 그대로 받아지게 둔다
            }

            zip.finish();
            return new LogoDownloadArchive("genmark-logo.zip", bytes.toByteArray());
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public record LogoDownloadArchive(String filename, byte[] bytes) {}

    /**
     * 후보가 지금 편집본을 쓰고 있으면 그 리비전을, 아니면(한 번도 편집 안 했거나 원본으로
     * 되돌렸으면) null을 돌려준다. {@link LogoSvgService}의 같은 이름 헬퍼와 동일한 규칙 —
     * 편집 화면이 보여주는 SVG와 다운로드가 담는 SVG가 항상 같은 파일을 가리키게 한다.
     */
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

    public List<LogoDownloadResponse> myDownloads(Long memberId, LogoDownload.ProjectType projectType) {
        return downloadRepository.findByMemberIdAndProjectTypeOrderByDownloadedAtDesc(memberId, projectType)
                .stream().map(d -> toResponse(d, false)).toList();
    }

    /**
     * 보관 한도를 넘긴 오래된 기록을 지운다.
     *
     * <p>CI와 BI를 각각 20개씩 유지한다. 한쪽이 넘쳐도 다른 쪽은 건드리지 않는다.
     * DB 행과 이미지 파일을 함께 지워야 저장 공간이 실제로 회수된다.
     */
    private void enforceRetentionLimit(Long memberId, LogoDownload.ProjectType projectType) {
        List<LogoDownload> all = downloadRepository
                .findByMemberIdAndProjectTypeOrderByDownloadedAtAsc(memberId, projectType);
        int excess = all.size() - retentionLimit;
        if (excess <= 0) return;

        List<LogoDownload> victims = all.subList(0, excess);
        victims.forEach(victim -> fileStorage.deleteQuietly(victim.getStorageKey()));
        downloadRepository.deleteAll(victims);
    }

    private LogoDownloadResponse toResponse(LogoDownload download, boolean firstTime) {
        ProjectLike project = download.getCandidate().getGeneration().getProject();
        return new LogoDownloadResponse(
                download.getId(),
                project.getPublicId(),
                download.getCandidate().getPublicId(),
                download.getProjectType().name(),
                "/api/v1/me/downloads/" + download.getId() + "/image",
                firstTime,
                download.getDownloadedAt());
    }
}
