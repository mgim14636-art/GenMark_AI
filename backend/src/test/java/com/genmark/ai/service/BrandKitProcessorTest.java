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
    @Test
    void usesCandidateStorageKeyAndRecordsItForSuccessfulKit() {
        BrandKitRepository repository = mock(BrandKitRepository.class);
        BrandKitAiClient aiClient = mock(BrandKitAiClient.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        CiProject project = CiProject.builder().build();
        LogoGeneration generation = LogoGeneration.builder().publicId("generation-1").ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().candidateOrder(1).storageKey("logos/original.png")
                .generation(generation).build();
        BrandKit kit = BrandKit.builder().id(9L).publicId("kit-1").candidate(candidate)
                .kitType(BrandKit.KitType.BUSINESS_CARD)
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
        when(aiClient.generate(argThat(request -> {
            Object raw = request.get("card_info");
            if (!(raw instanceof java.util.Map<?, ?> cardInfo)) return false;
            return Base64.getEncoder().encodeToString(new byte[]{1, 2, 3})
                    .equals(request.get("logo_image_base64"))
                    && "Kim".equals(cardInfo.get("name"))
                    && "CEO".equals(cardInfo.get("title"))
                    && "GenMark".equals(cardInfo.get("company"))
                    && "010-1111-2222".equals(cardInfo.get("phone"))
                    && "kim@example.com".equals(cardInfo.get("email"))
                    && "Gwangju".equals(cardInfo.get("address"));
        }))).thenReturn(List.of("front-png", "back-png"));
        when(storage.store(anyString(), eq(1), eq("front-png")))
                .thenReturn(new LogoFileStorage.StoredImage("brand-kits/front.png", 100, 100));
        when(storage.store(anyString(), eq(2), eq("back-png")))
                .thenReturn(new LogoFileStorage.StoredImage("brand-kits/back.png", 100, 100));

        new BrandKitProcessor(repository, aiClient, storage).process(9L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.SUCCEEDED);
        assertThat(kit.getStorageKey()).isEqualTo("brand-kits/front.png");
        verify(storage).read("logos/original.png");
        verify(storage).store("brand-kits/kit-1", 1, "front-png");
        verify(storage).store("brand-kits/kit-1", 2, "back-png");
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
        when(aiClient.generate(anyMap())).thenReturn(List.of("front-only"));

        new BrandKitProcessor(repository, aiClient, storage).process(10L);

        assertThat(kit.getStatus()).isEqualTo(BrandKit.Status.FAILED);
        verify(storage, never()).store(anyString(), anyInt(), anyString());
        verify(storage, never()).storeBrandKitSourceKey(anyString(), anyString());
    }
}
