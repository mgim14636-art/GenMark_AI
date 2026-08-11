package com.genmark.ai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code @Scheduled} 를 활성화한다.
 *
 * <p>현재 쓰는 곳: 보관 기간(3일)이 지난 찜을 해제하는
 * {@link com.genmark.ai.service.PinnedCandidateCleanup}.
 *
 * <p>주의: 서버를 여러 대로 늘리면 모든 인스턴스에서 같은 배치가 동시에 돈다.
 * 지금은 단일 인스턴스라 문제없지만, 다중화할 때는 락이나 전용 배치 서버가 필요하다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
