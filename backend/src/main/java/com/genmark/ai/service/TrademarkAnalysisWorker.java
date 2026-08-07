package com.genmark.ai.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class TrademarkAnalysisWorker {
    private final TrademarkAnalysisProcessor processor;
    public TrademarkAnalysisWorker(TrademarkAnalysisProcessor processor) { this.processor = processor; }

    @Async("aiTaskExecutor")
    public void execute(Long analysisId) { processor.process(analysisId); }
}
