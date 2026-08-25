package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(),
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
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(),
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
                surveyRepository, mock(LogoFileStorage.class), new ObjectMapper(),
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
    void redownloadingRefreshesArchiveToCandidatesCurrentStorageKey() {
        // 처음 받았을 때 보관본은 "candidate-1-edited.png"였는데, 그 뒤 후보가 원본으로
        // 되돌려져서 storageKey가 "candidate-1.png"로 바뀐 상태를 가정한다.
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        MemberRepository memberRepository = mock(MemberRepository.class);
        MemberSurveyRepository surveyRepository = mock(MemberSurveyRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);

        CiProject project = CiProject.builder().id(3L).publicId("project-1").build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(generation).storageKey("origin_logos/generation-1/candidate-1.png").build();
        LogoDownload existing = LogoDownload.builder().id(42L)
                .member(Member.builder().id(7L).build())
                .candidate(candidate)
                .projectType(LogoDownload.ProjectType.CI)
                .storageKey("downloads/7/candidate-1-edited.png").build();

        when(surveyRepository.existsByMemberId(7L)).thenReturn(true);
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(downloads.findByMemberIdAndCandidateId(7L, 4L)).thenReturn(Optional.of(existing));
        when(storage.archiveForDownload(7L, "candidate-1", "origin_logos/generation-1/candidate-1.png"))
                .thenReturn("downloads/7/candidate-1.png");

        LogoDownloadService service = new LogoDownloadService(projectLookup, candidateRepository,
                downloads, memberRepository, surveyRepository, storage, new ObjectMapper(), 20);

        service.download("project-1", "candidate-1", 7L);

        assertThat(existing.getStorageKey()).isEqualTo("downloads/7/candidate-1.png");
        verify(downloads).save(existing);
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
        when(storage.readSvg("generation-1", 1, null)).thenReturn("svg-bytes".getBytes(StandardCharsets.UTF_8));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(), 20);

        LogoDownloadService.LogoDownloadArchive archive = service.downloadArchive(42L, 7L);

        assertThat(archive.filename()).isEqualTo("genmark-logo.zip");
        assertThat(unzipTextEntries(archive.bytes())).containsExactly(
                Map.entry("logo.png", "png-bytes"),
                Map.entry("logo.svg", "svg-bytes"));
    }

    @Test
    void downloadArchiveUsesTheEditedRevisionSvgWhenCandidateHasBeenEdited() throws IOException {
        // 후보가 수정된 적 있으면 aiMetadataJson에 svgRevision이 남아 있다. 예전에는 이 값을
        // 무시하고 항상 원본 SVG를 담아서, "수정했는데 다운로드에는 원본 SVG가 나온다"는
        // 버그가 있었다 — 리비전이 실제로 readSvg에 전달되는지 이 테스트로 고정한다.
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1")
                .ciProject(CiProject.builder().build()).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1).generation(generation)
                .aiMetadataJson("{\"svgAvailable\":true,\"svgEdited\":true,\"svgRevision\":\"abc123\"}").build();
        LogoDownload download = LogoDownload.builder().id(42L)
                .member(Member.builder().id(7L).build())
                .candidate(candidate)
                .storageKey("downloads/7/candidate-1.png").build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        when(storage.read("downloads/7/candidate-1.png")).thenReturn("png-bytes".getBytes(StandardCharsets.UTF_8));
        when(storage.readSvg("generation-1", 1, "abc123")).thenReturn("edited-svg-bytes".getBytes(StandardCharsets.UTF_8));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(), 20);

        LogoDownloadService.LogoDownloadArchive archive = service.downloadArchive(42L, 7L);

        assertThat(unzipTextEntries(archive.bytes())).containsExactly(
                Map.entry("logo.png", "png-bytes"),
                Map.entry("logo.svg", "edited-svg-bytes"));
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
        when(storage.readSvg("generation-1", 1, null)).thenThrow(new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class),
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(), 20);

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
                mock(MemberSurveyRepository.class), storage, new ObjectMapper(), 20);

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
