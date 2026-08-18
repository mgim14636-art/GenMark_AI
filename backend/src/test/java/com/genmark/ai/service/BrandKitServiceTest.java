package com.genmark.ai.service;

import com.genmark.ai.entity.*;
import com.genmark.ai.repository.BrandKitRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.web.dto.brandkit.BrandKitCreateRequest;
import com.genmark.ai.web.dto.brandkit.BrandKitResponse;
import com.genmark.ai.web.dto.brandkit.BusinessCardInfoRequest;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class BrandKitServiceTest {

    @Test
    void createsRequestedThumbnailWithoutBusinessCardInfo() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(LogoGeneration.builder().ciProject(project).build()).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.empty());
        when(brandKitRepository.save(any(BrandKit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BrandKitResponse response = service.create("project-1", "candidate-1", 7L,
                new BrandKitCreateRequest("THUMBNAIL", null));

        assertThat(response.kitType()).isEqualTo("THUMBNAIL");
        verify(brandKitRepository).save(argThat(kit -> kit.getKitType() == BrandKit.KitType.THUMBNAIL
                && kit.getBusinessCardInfo() == null
                && kit.getRenderSpecJson().contains("\"kit_type\":\"THUMBNAIL\"")));
        verify(worker).execute(any());
    }

    @Test
    void listsMemberBrandKitsAcrossCiAndBiInNewestFirstOrder() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);

        CiProject ciProject = CiProject.builder().publicId("ci-project").build();
        BiProject biProject = BiProject.builder().publicId("bi-project").build();
        LogoCandidate ciCandidate = LogoCandidate.builder().publicId("ci-candidate")
                .generation(LogoGeneration.builder().ciProject(ciProject).build()).build();
        LogoCandidate biCandidate = LogoCandidate.builder().publicId("bi-candidate")
                .generation(LogoGeneration.builder().biProject(biProject).build()).build();
        BrandKit older = BrandKit.builder().publicId("older").candidate(ciCandidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED)
                .storageKey("logos/brand-kits/older.png").createdAt(LocalDateTime.parse("2026-08-14T10:00:00")).build();
        BrandKit newer = BrandKit.builder().publicId("newer").candidate(biCandidate)
                .kitType(BrandKit.KitType.THUMBNAIL).status(BrandKit.Status.SUCCEEDED)
                .storageKey("logos/brand-kits/newer.png").preliminary(true)
                .warnings(List.of("AI 연출 배경 미적용"))
                .createdAt(LocalDateTime.parse("2026-08-14T11:00:00")).build();
        when(brandKitRepository.findByCandidateGenerationCiProjectMemberIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(older));
        when(brandKitRepository.findByCandidateGenerationBiProjectMemberIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(newer));

        var responses = service.listForMember(7L);

        assertThat(responses).extracting(response -> response.id()).containsExactly("newer", "older");
        assertThat(responses).extracting(response -> response.projectId()).containsExactly("bi-project", "ci-project");
        assertThat(responses.get(0).preliminary()).isTrue();
        assertThat(responses.get(0).warnings()).containsExactly("AI 연출 배경 미적용");
    }

    @Test
    void createsNewKitWhenSuccessfulKitUsedDifferentCandidateStorageKey() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1").generation(generation)
                .storageKey("logos/current-revision.png").build();
        BrandKit stale = BrandKit.builder().publicId("kit-old").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.of(stale));
        when(storage.brandKitSourceKeyMatches("kit-old", "logos/current-revision.png")).thenReturn(false);
        when(brandKitRepository.save(any(BrandKit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create("project-1", "candidate-1", 7L, request("Kim", "010-1111-2222"));

        assertThat(response.status()).isEqualTo("QUEUED");
        verify(brandKitRepository).save(any(BrandKit.class));
        verify(worker).execute(any());
    }

    @Test
    void reusesSuccessfulKitWhenSidecarMatchesCandidateStorageKey() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1").generation(generation)
                .storageKey("logos/current-revision.png").build();
        BrandKit current = BrandKit.builder().publicId("kit-1").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED).build();
        current.setBusinessCardInfo(info(current, "Kim", "010-1111-2222"));
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.of(current));
        when(storage.brandKitSourceKeyMatches("kit-1", "logos/current-revision.png")).thenReturn(true);
        when(storage.brandKitHasExpectedImageCount("kit-1", 2)).thenReturn(true);

        var response = service.create("project-1", "candidate-1", 7L, request("Kim", "010-1111-2222"));

        assertThat(response.id()).isEqualTo("kit-1");
        verify(brandKitRepository, never()).save(any());
        verifyNoInteractions(worker);
    }

    @Test
    void createsNewBusinessCardWhenLegacyKitHasNoBackImage() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1").generation(generation)
                .storageKey("logos/current-revision.png").build();
        BrandKit legacy = BrandKit.builder().publicId("kit-legacy").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.of(legacy));
        when(storage.brandKitSourceKeyMatches("kit-legacy", "logos/current-revision.png")).thenReturn(true);
        when(storage.brandKitHasExpectedImageCount("kit-legacy", 2)).thenReturn(false);
        when(brandKitRepository.save(any(BrandKit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create("project-1", "candidate-1", 7L, request("Kim", "010-1111-2222"));

        assertThat(response.status()).isEqualTo("QUEUED");
        verify(brandKitRepository).save(any(BrandKit.class));
        verify(worker).execute(any());
    }

    @Test
    void storesTrimmedBusinessCardInfoWithNewKit() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(LogoGeneration.builder().ciProject(project).build()).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.empty());
        when(brandKitRepository.save(any(BrandKit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.create("project-1", "candidate-1", 7L,
                new BrandKitCreateRequest(new BusinessCardInfoRequest(
                        "  Kim  ", "  CEO  ", "  GenMark  ", "  010-1111-2222  ",
                        "  kim@example.com  ", "  Gwangju  ")));

        verify(brandKitRepository).save(argThat(kit -> {
            BusinessCardInfo info = kit.getBusinessCardInfo();
            return info != null
                    && "Kim".equals(info.getName())
                    && "CEO".equals(info.getTitle())
                    && "GenMark".equals(info.getCompany())
                    && "010-1111-2222".equals(info.getPhone())
                    && "kim@example.com".equals(info.getEmail())
                    && "Gwangju".equals(info.getAddress())
                    && info.getBrandKit() == kit;
        }));
    }

    @Test
    void rejectsBusinessCardCreationWithoutCardInfo() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(LogoGeneration.builder().ciProject(project).build()).build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.create("project-1", "candidate-1", 7L, null))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
        verifyNoInteractions(brandKitRepository, worker);
    }

    @Test
    void createsNewBusinessCardWhenContactInfoChanged() {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(LogoGeneration.builder().ciProject(project).build())
                .storageKey("logos/current-revision.png").build();
        BrandKit current = BrandKit.builder().publicId("kit-1").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED).build();
        current.setBusinessCardInfo(info(current, "Kim", "010-0000-0000"));
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(candidateRepository.findByPublicIdAndGenerationCiProjectIdAndGenerationCiProjectMemberId(
                "candidate-1", 3L, 7L)).thenReturn(Optional.of(candidate));
        // Changed contact data produces a different render-spec hash, so an exact cache lookup misses.
        when(brandKitRepository.findFirstByCandidateIdAndKitTypeAndRenderSpecHashAndStatusOrderByCompletedAtDesc(
                any(), any(), anyString(), any())).thenReturn(Optional.empty());
        when(storage.brandKitSourceKeyMatches("kit-1", "logos/current-revision.png")).thenReturn(true);
        when(storage.brandKitHasExpectedImageCount("kit-1", 2)).thenReturn(true);
        when(brandKitRepository.save(any(BrandKit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create("project-1", "candidate-1", 7L, request("Kim", "010-9999-9999"));

        assertThat(response.status()).isEqualTo("QUEUED");
        verify(brandKitRepository).save(any(BrandKit.class));
    }

    @Test
    void downloadsBusinessCardAsSingleZipWithFrontAndBack() throws IOException {
        ProjectLookupService projectLookup = mock(ProjectLookupService.class);
        LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
        BrandKitRepository brandKitRepository = mock(BrandKitRepository.class);
        BrandKitWorker worker = mock(BrandKitWorker.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BrandKitService service = new BrandKitService(projectLookup, candidateRepository,
                brandKitRepository, worker, storage);
        Member member = Member.builder().id(7L).build();
        CiProject project = CiProject.builder().id(3L).publicId("project-1").member(member).build();
        LogoCandidate candidate = LogoCandidate.builder().id(4L).publicId("candidate-1")
                .generation(LogoGeneration.builder().ciProject(project).build()).build();
        BrandKit kit = BrandKit.builder().publicId("kit-1").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.SUCCEEDED)
                .storageKey("front-key").build();
        when(projectLookup.requireOwned("project-1", 7L)).thenReturn(project);
        when(brandKitRepository.findByPublicId("kit-1")).thenReturn(Optional.of(kit));
        when(storage.brandKitStorageKeys("kit-1", "front-key"))
                .thenReturn(List.of("front-key", "back-key"));
        when(storage.read("front-key")).thenReturn("front-image".getBytes(StandardCharsets.UTF_8));
        when(storage.read("back-key")).thenReturn("back-image".getBytes(StandardCharsets.UTF_8));
        when(storage.readBrandKitPrintAsset("kit-1", 1)).thenReturn(java.util.Optional.of(
                new LogoFileStorage.BrandKitPrintAsset("front-svg".getBytes(StandardCharsets.UTF_8),
                        "front-pdf".getBytes(StandardCharsets.UTF_8))));
        when(storage.readBrandKitPrintAsset("kit-1", 2)).thenReturn(java.util.Optional.of(
                new LogoFileStorage.BrandKitPrintAsset("back-svg".getBytes(StandardCharsets.UTF_8),
                        "back-pdf".getBytes(StandardCharsets.UTF_8))));

        BrandKitService.BrandKitArchive archive = service.downloadArchive(
                "project-1", "candidate-1", "kit-1", 7L);

        assertThat(archive.filename()).isEqualTo("genmark-business-card.zip");
        Map<String, String> entries = unzipTextEntries(archive.bytes());
        assertThat(entries).containsExactly(
                Map.entry("front.png", "front-image"),
                Map.entry("back.png", "back-image"),
                Map.entry("front.svg", "front-svg"),
                Map.entry("front.pdf", "front-pdf"),
                Map.entry("back.svg", "back-svg"),
                Map.entry("back.pdf", "back-pdf"));
    }

    private BrandKitCreateRequest request(String name, String phone) {
        return new BrandKitCreateRequest(new BusinessCardInfoRequest(
                name, "CEO", "GenMark", phone, "kim@example.com", "Gwangju"));
    }

    private BusinessCardInfo info(BrandKit kit, String name, String phone) {
        return BusinessCardInfo.builder()
                .brandKit(kit)
                .name(name)
                .title("CEO")
                .company("GenMark")
                .phone(phone)
                .email("kim@example.com")
                .address("Gwangju")
                .build();
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
