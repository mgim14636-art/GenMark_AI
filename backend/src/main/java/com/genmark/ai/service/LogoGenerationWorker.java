package com.genmark.ai.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class LogoGenerationWorker {
    private final LogoGenerationProcessor processor;

    public LogoGenerationWorker(LogoGenerationProcessor processor) { this.processor = processor; }

    @Async("aiTaskExecutor")
    public void execute(Long generationId) { processor.process(generationId); }
}
