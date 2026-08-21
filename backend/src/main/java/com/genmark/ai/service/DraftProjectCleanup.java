package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.BiProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 오래 방치된 미완성 CI/BI 초안을 자동으로 지운다.
 *
 * <p>DRAFT/BRIEF_READY는 아직 로고 생성을 시작하지 않은 상태라, 마지막 수정 후
 * 보관 기간(기본 3일)이 지나면 사용자가 다시 돌아오지 않은 것으로 보고 삭제한다.
 * GENERATING 이후로 넘어간 프로젝트는 생성 이력·후보 이미지가 딸려 있어 대상에서 뺀다.
 */
@Component
public class DraftProjectCleanup {

    private static final Logger log = LoggerFactory.getLogger(DraftProjectCleanup.class);
    private static final List<ProjectStatus> UNFINISHED = List.of(ProjectStatus.DRAFT, ProjectStatus.BRIEF_READY);

    private final CiProjectRepository ciProjectRepository;
    private final BiProjectRepository biProjectRepository;
    private final long retentionDays;

    public DraftProjectCleanup(CiProjectRepository ciProjectRepository, BiProjectRepository biProjectRepository,
                                @Value("${app.project-draft.retention-days:3}") long retentionDays) {
        this.ciProjectRepository = ciProjectRepository;
        this.biProjectRepository = biProjectRepository;
        this.retentionDays = retentionDays;
    }

    /** 1시간마다 실행한다. 서버가 꺼져 있었어도 다음 실행 때 밀린 만료분이 정리된다. */
    @Scheduled(fixedDelayString = "${app.project-draft.cleanup-interval-ms:3600000}")
    @Transactional
    public void deleteStaleDrafts() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(retentionDays);

        List<CiProject> staleCi = ciProjectRepository.findByStatusInAndUpdatedAtBefore(UNFINISHED, threshold);
        if (!staleCi.isEmpty()) {
            ciProjectRepository.deleteAll(staleCi);
            log.info("초안 보관 기간({}일) 만료로 CI 프로젝트 {}건을 삭제했습니다.", retentionDays, staleCi.size());
        }

        List<BiProject> staleBi = biProjectRepository.findByStatusInAndUpdatedAtBefore(UNFINISHED, threshold);
        if (!staleBi.isEmpty()) {
            biProjectRepository.deleteAll(staleBi);
            log.info("초안 보관 기간({}일) 만료로 BI 프로젝트 {}건을 삭제했습니다.", retentionDays, staleBi.size());
        }
    }
}
