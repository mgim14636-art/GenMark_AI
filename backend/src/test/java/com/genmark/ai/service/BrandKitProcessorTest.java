package com.genmark.ai.service;

import com.genmark.ai.client.BrandKitAiClient;
import com.genmark.ai.entity.*;
import com.genmark.ai.repository.BrandKitRepository;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class BrandKitProcessorTest {
    private static final String SVG_REVISION = "a".repeat(64);

    @Test
    void sendsSelectedLogoAndStoresExactlyOneThumbnail() {
        BrandKitRepository repository = mock(BrandKitRepository.class);
        BrandKitAiClient aiClient = mock(BrandKitAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        BiProject project = BiProject.builder().brandName("젠마크").build();
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-bi")
                .biProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1)
                .storageKey("logos/selected.png").generation(generation).build();
        BrandKit kit = BrandKit.builder().id(8L).publicId("kit-thumbnail").candidate(candidate)
                .kitType(BrandKit.KitType.THUMBNAIL)
                .renderSpecJson("""
                        {"survey":{"brand_name":"젠마크","color_manual":["#4F46E5"]}}
                        """)
                .status(BrandKit.Status.QUEUED).build();
        when(repository.findById(8L)).thenReturn(Optional.of(kit));
        when(storage.read("logos/selected.png")).thenReturn(new byte[]{1, 2, 3});
        when(aiClient.generate(argThat(request -> {
            Object rawSurvey = request.get("survey");
            if (!(rawSurvey instanceof java.util.Map<?, ?> survey)) return false;
            return "THUMBNAIL".equals(request.get("kit_type"))
                    && "BI".equals(request.get("ci_bi"))
                    && Base64.getEncoder().encodeToString(new byte[]{1, 2, 3})
                    .equals(request.get("logo_image_base64"))
                    && "젠마크".equals(survey.get("brand_name"));
        }))).thenReturn(new BrandKitAiClient.Result(
                List.of("thumbnail-png"), false, List.of()));
        when(storage.store("brand_kits/kit-thumbnail", 1, "thumbnail-png"))
                .thenReturn(new LogoFileStorage.StoredImage(
                        "brand_kits/kit-thumbnail/candidate-1.png", 1000, 1000));

        new BrandKitProcessor(repository, aiClient, storage).process(8L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.SUCCEEDED);
        assertThat(kit.getStorageKey())
                .isEqualTo("brand_kits/kit-thumbnail/candidate-1.png");
        assertThat(kit.isPreliminary()).isFalse();
        verify(storage).store("brand_kits/kit-thumbnail", 1, "thumbnail-png");
        verify(storage, never()).store(anyString(), eq(2), anyString());
        verify(storage).storeBrandKitSourceKey("kit-thumbnail", "logos/selected.png");
    }

    @Test
    void usesCandidateStorageKeyAndRecordsItForSuccessfulKit() {
        BrandKitRepository repository = mock(BrandKitRepository.class);
        BrandKitAiClient aiClient = mock(BrandKitAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().companyName("현재 회사명").build();
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1").ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1).storageKey("logos/original.png")
                .aiMetadataJson("{\"svgRevision\":\"" + SVG_REVISION + "\"}")
                .generation(generation).build();
        BrandKit kit = BrandKit.builder().id(9L).publicId("kit-1").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD)
                .renderSpecJson("""
                        {"survey":{"company_name":"생성 당시 회사명"},"card_design":{"schema_version":1,"front":{"background_color":"#112233"}}}
                        """)
                .status(BrandKit.Status.QUEUED).build();
        kit.setBusinessCardInfo(BusinessCardInfo.builder()
                .brandKit(kit)
                .name("Kim")
                .title("CEO")
                .company("GenMark")
                .phone("010-1111-2222")
                .email("kim@example.com")
                .address("Gwangju")
                .build());
        when(repository.findById(9L)).thenReturn(Optional.of(kit));
        when(storage.read("logos/original.png")).thenReturn(new byte[]{1, 2, 3});
        when(storage.readSvg("generation-1", 1, SVG_REVISION)).thenReturn("<svg/>".getBytes());
        when(aiClient.generate(argThat(request -> {
            Object raw = request.get("card_info");
            if (!(raw instanceof java.util.Map<?, ?> cardInfo)) return false;
            Object rawSurvey = request.get("survey");
            if (!(rawSurvey instanceof java.util.Map<?, ?> survey)) return false;
            return Base64.getEncoder().encodeToString(new byte[]{1, 2, 3})
                    .equals(request.get("logo_image_base64"))
                    && "<svg/>".equals(request.get("logo_svg"))
                    && !request.containsKey("card_design")
                    && "생성 당시 회사명".equals(survey.get("company_name"))
                    && "Kim".equals(cardInfo.get("name"))
                    && "CEO".equals(cardInfo.get("title"))
                    && "GenMark".equals(cardInfo.get("company"))
                    && "010-1111-2222".equals(cardInfo.get("phone"))
                    && "kim@example.com".equals(cardInfo.get("email"))
                    && "Gwangju".equals(cardInfo.get("address"));
        }))).thenReturn(new BrandKitAiClient.Result(
                List.of("front-png", "back-png"),
                List.of(new BrandKitAiClient.PrintAsset("front-svg", "front-pdf"),
                        new BrandKitAiClient.PrintAsset("back-svg", "back-pdf")),
                true, List.of("AI 연출 배경 미적용")));
        when(storage.store(anyString(), eq(1), eq("front-png")))
                .thenReturn(new LogoFileStorage.StoredImage("brand_kits/front.png", 100, 100));
        when(storage.store(anyString(), eq(2), eq("back-png")))
                .thenReturn(new LogoFileStorage.StoredImage("brand_kits/back.png", 100, 100));

        new BrandKitProcessor(repository, aiClient, storage).process(9L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.SUCCEEDED);
        assertThat(kit.getStorageKey()).isEqualTo("brand_kits/front.png");
        assertThat(kit.isPreliminary()).isTrue();
        assertThat(kit.getWarnings()).containsExactly("AI 연출 배경 미적용");
        verify(storage).read("logos/original.png");
        verify(storage).readSvg("generation-1", 1, SVG_REVISION);
        verify(storage).store("brand_kits/kit-1", 1, "front-png");
        verify(storage).store("brand_kits/kit-1", 2, "back-png");
        verify(storage).storeBrandKitPrintAsset("kit-1", 1, "front-svg", "front-pdf");
        verify(storage).storeBrandKitPrintAsset("kit-1", 2, "back-svg", "back-pdf");
        verify(storage).storeBrandKitSourceKey("kit-1", "logos/original.png");
    }

    @Test
    void failsBusinessCardWhenAiReturnsOnlyOneSide() {
        BrandKitRepository repository = mock(BrandKitRepository.class);
        BrandKitAiClient aiClient = mock(BrandKitAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().build();
        LogoCandidate candidate = LogoCandidate.builder()
                .storageKey("logos/original.png")
                .generation(LogoGeneration.builder().ciProject(project).build())
                .build();
        BrandKit kit = BrandKit.builder().id(10L).publicId("kit-partial").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD)
                .status(BrandKit.Status.QUEUED).build();
        when(repository.findById(10L)).thenReturn(Optional.of(kit));
        when(storage.read("logos/original.png")).thenReturn(new byte[]{1, 2, 3});
        when(aiClient.generate(anyMap())).thenReturn(
                new BrandKitAiClient.Result(List.of("front-only"), false, List.of()));

        new BrandKitProcessor(repository, aiClient, storage).process(10L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.FAILED);
        verify(storage, never()).store(anyString(), anyInt(), anyString());
        verify(storage, never()).storeBrandKitSourceKey(anyString(), anyString());
    }

    @Test
    void failsBusinessCardWhenPrintAssetsAreMissing() {
        BrandKitRepository repository = mock(BrandKitRepository.class);
        BrandKitAiClient aiClient = mock(BrandKitAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoCandidate candidate = LogoCandidate.builder()
                .storageKey("logos/original.png")
                .generation(LogoGeneration.builder().publicId("generation-1")
                        .ciProject(CiProject.builder().build()).build())
                .build();
        BrandKit kit = BrandKit.builder().id(11L).publicId("kit-no-print").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD).status(BrandKit.Status.QUEUED).build();
        when(repository.findById(11L)).thenReturn(Optional.of(kit));
        when(storage.read("logos/original.png")).thenReturn(new byte[]{1, 2, 3});
        when(aiClient.generate(anyMap())).thenReturn(
                new BrandKitAiClient.Result(List.of("front", "back"), false, List.of()));

        new BrandKitProcessor(repository, aiClient, storage).process(11L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.FAILED);
        assertThat(kit.getErrorCode()).isEqualTo("AI_INVALID_RESPONSE");
        assertThat(kit.getErrorMessage()).contains("SVG/PDF");
        verify(storage, never()).store(anyString(), anyInt(), anyString());
    }
}
