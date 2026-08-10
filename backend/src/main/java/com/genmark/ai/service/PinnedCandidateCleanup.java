package com.genmark.ai.service;

import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.repository.LogoCandidateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 보관 기간이 지난 찜을 자동으로 해제한다.
 *
 * <p>찜은 "애매하게 마음에 드는 로고를 잠깐 보류해두는" 기능이라 보관 기간이 3일이다.
 * 지나면 {@code pinned_at}을 null로 되돌려 찜 목록에서 사라지게 한다.
 *
 * <p>후보 행이나 이미지 파일 자체는 지우지 않는다. 찜은 어디까지나 표시일 뿐이고,
 * 같은 후보가 다운로드되었거나 선택되었을 수도 있기 때문이다.
 */
@Component
public class PinnedCandidateCleanup {

    private static final Logger log = LoggerFactory.getLogger(PinnedCandidateCleanup.class);

    private final LogoCandidateRepository candidateRepository;
    private final long retentionDays;

    public PinnedCandidateCleanup(LogoCandidateRepository candidateRepository,
                                  @Value("${app.pin.retention-days:3}") long retentionDays) {
        this.candidateRepository = candidateRepository;
        this.retentionDays = retentionDays;
    }

    /**
     * 1시간마다 실행한다. 찜 만료는 분 단위 정확도가 필요 없고, 자주 돌수록 DB만 긁게 된다.
     * 서버가 꺼져 있었더라도 다음 실행 때 밀린 만료분이 한꺼번에 정리되므로 놓치지 않는다.
     */
    @Scheduled(fixedDelayString = "${app.pin.cleanup-interval-ms:3600000}")
    @Transactional
    public void expirePins() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(retentionDays);
        List<LogoCandidate> expired = candidateRepository.findByPinnedAtIsNotNullAndPinnedAtBefore(threshold);
        if (expired.isEmpty()) return;

        expired.forEach(candidate -> candidate.setPinnedAt(null));
        log.info("찜 보관 기간({}일) 만료로 {}건을 해제했습니다.", retentionDays, expired.size());
    }
}
