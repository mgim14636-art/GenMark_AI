package com.genmark.ai.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 브랜드킷 생성을 백그라운드로 넘기는 얇은 래퍼.
 * {@link LogoGenerationWorker}와 같은 구조이며 같은 스레드 풀을 쓴다.
 */
@Component
public class BrandKitWorker {
    private final BrandKitProcessor processor;

    public BrandKitWorker(BrandKitProcessor processor) { this.processor = processor; }

    @Async("aiTaskExecutor")
    public void execute(Long brandKitId) { processor.process(brandKitId); }
}
