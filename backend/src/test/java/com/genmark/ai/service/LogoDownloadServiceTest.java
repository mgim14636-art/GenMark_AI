package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class LogoDownloadServiceTest {

    @Test
    void deletesOwnedDownloadAndArchivedFile() {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoDownload download = LogoDownload.builder()
                .id(42L)
                .member(Member.builder().id(7L).build())
                .storageKey("downloads/7/candidate-1.png")
                .build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage,
                20);

        service.delete(42L, 7L);

        verify(storage).deleteQuietly("downloads/7/candidate-1.png");
        verify(downloads).delete(download);
    }

    @Test
    void refusesDownloadOwnedByAnotherMember() {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoDownload download = LogoDownload.builder()
                .id(42L)
                .member(Member.builder().id(7L).build())
                .storageKey("downloads/7/candidate-1.png")
                .build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage,
                20);

        assertThatThrownBy(() -> service.delete(42L, 9L))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode())
                                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(storage);
        verify(downloads, never()).delete(any());
    }

    @Test
    void refusesDownloadWhenMemberHasNeverCompletedTheSurvey() {
        MemberSurveyRepository surveyRepository = mock(MemberSurveyRepository.class);
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        when(surveyRepository.existsByMemberId(7L)).thenReturn(false);
        LogoDownloadService service = new LogoDownloadService(projectLookup,
                candidateRepository, mock(LogoDownloadRepository.class), mock(MemberRepository.class),
                surveyRepository, mock(LogoFileStorage.class),
                20);

        assertThatThrownBy(() -> service.download("project-1", "candidate-1", 7L))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode())
                                .isEqualTo(ErrorCode.SURVEY_REQUIRED));
        // 설문 미완료면 프로젝트/후보 조회조차 없이 즉시 막아야 한다 — 이미 받은 적 있는
        // 후보를 다시 받으려는 요청도 예외 없이 걸려야 하므로, 조회 로직보다 먼저 확인한다.
        verifyNoInteractions(projectLookup, candidateRepository);
    }

    @Test
    void downloadArchiveBundlesPngAndSvg() throws IOException {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1")
                .ciProject(CiProject.builder().build()).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1).generation(generation).build();
        LogoDownload download = LogoDownload.builder().id(42L)
                .member(Member.builder().id(7L).build())
                .candidate(candidate)
                .storageKey("downloads/7/candidate-1.png").build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        when(storage.read("downloads/7/candidate-1.png")).thenReturn("png-bytes".getBytes(StandardCharsets.UTF_8));
        when(storage.readPreferredSvg("generation-1", 1)).thenReturn("svg-bytes".getBytes(StandardCharsets.UTF_8));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, 20);

        LogoDownloadService.LogoDownloadArchive archive = service.downloadArchive(42L, 7L);

        assertThat(archive.filename()).isEqualTo("genmark-logo.zip");
        assertThat(unzipTextEntries(archive.bytes())).containsExactly(
                Map.entry("logo.png", "png-bytes"),
                Map.entry("logo.svg", "svg-bytes"));
    }

    @Test
    void downloadArchiveFallsBackToPngOnlyWhenSvgMissing() throws IOException {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1")
                .ciProject(CiProject.builder().build()).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1).generation(generation).build();
        LogoDownload download = LogoDownload.builder().id(42L)
                .member(Member.builder().id(7L).build())
                .candidate(candidate)
                .storageKey("downloads/7/candidate-1.png").build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        when(storage.read("downloads/7/candidate-1.png")).thenReturn("png-bytes".getBytes(StandardCharsets.UTF_8));
        when(storage.readPreferredSvg("generation-1", 1)).thenThrow(new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, 20);

        LogoDownloadService.LogoDownloadArchive archive = service.downloadArchive(42L, 7L);

        assertThat(unzipTextEntries(archive.bytes()))
                .containsExactly(Map.entry("logo.png", "png-bytes"));
    }

    @Test
    void downloadArchiveRefusesDownloadOwnedByAnotherMember() {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoDownload download = LogoDownload.builder().id(42L)
                .member(Member.builder().id(7L).build())
                .storageKey("downloads/7/candidate-1.png").build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, 20);

        assertThatThrownBy(() -> service.downloadArchive(42L, 9L))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(storage);
    }

    private Map<String, String> unzipTextEntries(byte[] bytes) throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return entries;
    }
}
