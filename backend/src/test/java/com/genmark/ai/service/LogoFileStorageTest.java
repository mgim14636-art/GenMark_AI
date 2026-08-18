package com.genmark.ai.service;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.imageio.ImageIO;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LogoFileStorageTest {
    @TempDir Path tempDir;

    @Test
    void keepsOriginalImmutableAndPrefersEditedSvg() {
        LogoFileStorage storage = storage();
        String original = "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0\"/></svg>";
        String edited = "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1 1\"/></svg>";

        storage.storeOriginalSvg("generation-1", 1, original);
        storage.storeOriginalSvg("generation-1", 1, original);
        storage.storeEditedSvg("generation-1", 1, edited);

        assertThat(storage.readSvg("generation-1", 1, null))
                .isEqualTo(edited.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(tempDir.resolve("private/logos/generation-1/candidate-1.svg"))
                .hasContent(original);
        assertThat(tempDir.resolve("private/logos/generation-1/candidate-1-edited.svg"))
                .hasContent(edited);
    }

    @Test
    void refusesToOverwriteOriginalWithDifferentSvg() {
        LogoFileStorage storage = storage();
        storage.storeOriginalSvg("generation-1", 1, "<svg><path/></svg>");

        assertThatThrownBy(() -> storage.storeOriginalSvg("generation-1", 1, "<svg><circle/></svg>"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_CONFLICT));
    }

    @Test
    void rejectsUnsafeSvgContentAndOversizedSvg() {
        LogoFileStorage storage = storage();

        assertUnsafe(storage, "<html/>");
        assertUnsafe(storage, "<svg><script>alert(1)</script></svg>");
        assertUnsafe(storage, "<svg><foreignObject/></svg>");
        assertUnsafe(storage, "<svg onload=\"alert(1)\"/>");
        assertUnsafe(storage, "<svg><a href=\"javascript:alert(1)\"/></svg>");
        assertUnsafe(storage, "<svg><image href=\"https://example.com/a.png\"/></svg>");
        assertUnsafe(storage, "<svg><style>@import url(https://example.com/a.css)</style></svg>");
        assertUnsafe(storage, "<svg><path fill=\"url(https://example.com/a.svg)\"/></svg>");
        assertUnsafe(storage, "<?xml-stylesheet href=\"https://example.com/a.css\"?><svg/>");
        assertUnsafe(storage, "<svg>" + " ".repeat(2_000) + "</svg>");
    }

    @Test
    void rejectsPathTraversal() {
        LogoFileStorage storage = storage();

        assertThatThrownBy(() -> storage.storeEditedSvg("../outside", 1, "<svg/>"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_ERROR));
    }

    @Test
    void rejectsPrivateStorageInsidePublicUploads() {
        assertThatThrownBy(() -> new LogoFileStorage(tempDir.resolve("uploads").toString(),
                tempDir.resolve("uploads/private").toString(), 1_024))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void storesEditedAssetsAsImmutableRevisionFiles() throws Exception {
        LogoFileStorage storage = storage();
        String svg = "<svg><path/></svg>";

        LogoFileStorage.StoredEditedAsset asset = storage.storeEditedAssets(
                "generation-1", 1, svg, pngBase64(1024, 1024));

        assertThat(asset.revision()).matches("[0-9a-f]{64}");
        assertThat(asset.storageKey()).isEqualTo(
                "logos/generation-1/candidate-1-" + asset.revision() + ".png");
        assertThat(asset.width()).isEqualTo(1024);
        assertThat(asset.height()).isEqualTo(1024);
        assertThat(tempDir.resolve("public").resolve(asset.storageKey())).exists();
        assertThat(tempDir.resolve("private/logos/generation-1/candidate-1-"
                + asset.revision() + ".svg")).hasContent(svg);
        assertThat(storage.readSvg("generation-1", 1, asset.revision()))
                .isEqualTo(svg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void revisionWriteLeavesExistingActivePngUntouched() throws Exception {
        LogoFileStorage storage = storage();
        String original = pngBase64(2, 2);
        LogoFileStorage.StoredImage active = storage.store("generation-1", 1, original);

        LogoFileStorage.StoredEditedAsset orphan = storage.storeEditedAssets(
                "generation-1", 1, "<svg><path/></svg>", pngBase64(1024, 1024));

        assertThat(storage.read(active.storageKey())).isEqualTo(Base64.getDecoder().decode(original));
        assertThat(orphan.storageKey()).isNotEqualTo(active.storageKey());
    }

    @Test
    void concurrentDifferentEditsKeepEachRevisionPairTogether() throws Exception {
        LogoFileStorage storage = storage();
        String firstSvg = "<svg><path id=\"first\"/></svg>";
        String secondSvg = "<svg><path id=\"second\"/></svg>";
        String firstPng = pngBase64(1024, 1024, 0xffff0000);
        String secondPng = pngBase64(1024, 1024, 0xff0000ff);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<LogoFileStorage.StoredEditedAsset> first = executor.submit(
                    () -> storage.storeEditedAssets("generation-1", 1, firstSvg, firstPng));
            Future<LogoFileStorage.StoredEditedAsset> second = executor.submit(
                    () -> storage.storeEditedAssets("generation-1", 1, secondSvg, secondPng));

            LogoFileStorage.StoredEditedAsset firstAsset = first.get();
            LogoFileStorage.StoredEditedAsset secondAsset = second.get();
            assertThat(firstAsset.revision()).isNotEqualTo(secondAsset.revision());
            assertThat(storage.readSvg("generation-1", 1, firstAsset.revision()))
                    .isEqualTo(firstSvg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            assertThat(storage.read(firstAsset.storageKey())).isEqualTo(Base64.getDecoder().decode(firstPng));
            assertThat(storage.readSvg("generation-1", 1, secondAsset.revision()))
                    .isEqualTo(secondSvg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            assertThat(storage.read(secondAsset.storageKey())).isEqualTo(Base64.getDecoder().decode(secondPng));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void rejectsEditedPngUnlessItIsExactly1024Square() throws Exception {
        LogoFileStorage storage = storage();

        assertThatThrownBy(() -> storage.storeEditedAssets("generation-1", 1, "<svg/>",
                pngBase64(1024, 1023)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
    }

    @Test
    void rejectsPngSignatureWithUndecodableImageBody() throws Exception {
        LogoFileStorage storage = storage();
        byte[] broken = new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3};

        assertThatThrownBy(() -> storage.storeEditedAssets("generation-1", 1, "<svg/>",
                Base64.getEncoder().encodeToString(broken)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
    }

    @Test
    void storesAndMatchesBrandKitSourceKeySidecar() {
        LogoFileStorage storage = storage();

        storage.storeBrandKitSourceKey("kit-1", "logos/generation-1/candidate-1-revision.png");

        assertThat(storage.brandKitSourceKeyMatches(
                "kit-1", "logos/generation-1/candidate-1-revision.png")).isTrue();
        assertThat(storage.brandKitSourceKeyMatches("kit-1", "logos/another.png")).isFalse();
        assertThat(storage.brandKitSourceKeyMatches("missing-kit", "logos/another.png")).isFalse();
    }

    private LogoFileStorage storage() {
        return new LogoFileStorage(tempDir.resolve("public").toString(),
                tempDir.resolve("private").toString(), 1_024);
    }

    private void assertUnsafe(LogoFileStorage storage, String svg) {
        assertThatThrownBy(() -> storage.storeEditedSvg("generation-1", 1, svg))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
    }

    private String pngBase64(int width, int height) throws Exception {
        return pngBase64(width, height, 0x00000000);
    }

    private String pngBase64(int width, int height, int firstPixelArgb) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(0, 0, firstPixelArgb);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return Base64.getEncoder().encodeToString(output.toByteArray());
    }
}
