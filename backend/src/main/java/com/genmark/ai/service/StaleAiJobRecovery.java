package com.genmark.ai.service;

import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.ProjectStatus;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
public class StaleAiJobRecovery implements ApplicationRunner {
    private final LogoGenerationRepository generationRepository;
    private final TrademarkAnalysisRepository analysisRepository;
    private final long staleMinutes;

    public StaleAiJobRecovery(LogoGenerationRepository generationRepository,
                              TrademarkAnalysisRepository analysisRepository,
                              @Value("${app.ai.stale-job-minutes:30}") long staleMinutes) {
        this.generationRepository = generationRepository;
        this.analysisRepository = analysisRepository;
        this.staleMinutes = staleMinutes;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(staleMinutes);
        generationRepository.findByStatusAndStartedAtBefore(LogoGeneration.Status.RUNNING, threshold).forEach(job -> {
            job.setStatus(LogoGeneration.Status.FAILED);
            job.setErrorCode("WORKER_RESTARTED");
            job.setErrorMessage("서버 재시작으로 생성 작업이 중단되었습니다. 다시 요청해 주세요.");
            job.setCompletedAt(LocalDateTime.now());
            job.getProject().setStatus(ProjectStatus.BRIEF_READY);
        });
        analysisRepository.findByStatusAndStartedAtBefore(TrademarkAnalysis.Status.RUNNING, threshold).forEach(job -> {
            job.setStatus(TrademarkAnalysis.Status.FAILED);
            job.setErrorCode("WORKER_RESTARTED");
            job.setErrorMessage("서버 재시작으로 분석 작업이 중단되었습니다. 다시 요청해 주세요.");
            job.setCompletedAt(LocalDateTime.now());
            job.getProject().setStatus(ProjectStatus.RESULT_READY);
        });
    }
}
