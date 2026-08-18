package com.genmark.ai.service;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.zip.DeflaterOutputStream;

import javax.imageio.ImageIO;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LogoFileStorageTest {
    private static final String CAIROSVG_PDF_BASE64 = "JVBERi0xLjcKJbXtrvsKNCAwIG9iago8PCAvTGVuZ3RoIDUgMCBSCiAgIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nC2MSw6DQAxD9zmFL0Ca38yEY3CEqmpZdQHcXyItyJJjK09WSGnSMg3l4WbpeH1powUbCYuNaPXmluEaFcbcZST2FY+nYD3ot2CRLK73CPY3PlStVNws8M7ZDP2i7vOnFjoB6PwbCAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKICAgMTA0CmVuZG9iagozIDAgb2JqCjw8CiAgIC9FeHRHU3RhdGUgPDwKICAgICAgL2EwIDw8IC9DQSAxIC9jYSAxID4+CiAgID4+Cj4+CmVuZG9iago3IDAgb2JqCjw8IC9UeXBlIC9PYmpTdG0KICAgL0xlbmd0aCA4IDAgUgogICAvTiAxCiAgIC9GaXJzdCA0CiAgIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nDNTMOCK5orlAgAGOAFdCmVuZHN0cmVhbQplbmRvYmoKOCAwIG9iagogICAxNgplbmRvYmoKOSAwIG9iago8PCAvVHlwZSAvT2JqU3RtCiAgIC9MZW5ndGggMTIgMCBSCiAgIC9OIDQKICAgL0ZpcnN0IDIzCiAgIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nFWRwWrDMBBE7/6KuZQmFGyt7KRKMDnEgVBKISS9lR6EIhxDsYwkl+bvKzmxS9FpHzuaGZbAEmJYsISDFpQQIRciKUtk79dOIzvIWrsEQPbanB0+wMFwxOeAKtO3HpRsNoPiYM25V9pipmRjDSglkRaYXbzv3DrLBlpb2V0a5VJj6/n89o3V0jem3UmvMdutOeNLJkgQ53xBT2z1yNh8NPmLhYdgHfUHaXXMEZMN4E2fG7k1PyEuC48XImU5FaslqKD0Oedc5FOF1gexQzGp99b0HcoyDnG+OQ50RKdArWxdF53VdcQv8LbX41SFrZ3+bpQ+7rcRhgaRH7UzvVXaIZ88T0Go/K2ICzf5V7aSXn6Z+t413ONeNSz9AqdtcaIKZW5kc3RyZWFtCmVuZG9iagoxMiAwIG9iagogICAyODgKZW5kb2JqCjEzIDAgb2JqCjw8IC9UeXBlIC9YUmVmCiAgIC9MZW5ndGggNTgKICAgL0ZpbHRlciAvRmxhdGVEZWNvZGUKICAgL1NpemUgMTQKICAgL1cgWzEgMiAyXQogICAvUm9vdCAxMSAwIFIKICAgL0luZm8gMTAgMCBSCj4+CnN0cmVhbQp4nGNgYPj/n4mBk4EBRDAxMtxiYGBk4AcRR0Bi7EAWoxKIWAIidkLUMYIIZkZmX6AYcwoDAwAKQwYoCmVuZHN0cmVhbQplbmRvYmoKc3RhcnR4cmVmCjg2OAolJUVPRgo=";

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
    void storesBusinessCardPrintAssetsOnlyInPrivateStorage() {
        LogoFileStorage storage = storage();
        String svg = Base64.getEncoder().encodeToString(
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0H1\"/></svg>"
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String pdf = Base64.getEncoder().encodeToString(minimalCardPdf(""));

        storage.storeBrandKitPrintAsset("kit-1", 1, svg, pdf);

        assertThat(tempDir.resolve("private/brand-kits/kit-1/front.svg")).exists();
        assertThat(tempDir.resolve("private/brand-kits/kit-1/front.pdf")).exists();
        assertThat(tempDir.resolve("public/brand-kits/kit-1/front.svg")).doesNotExist();
        assertThat(storage.readBrandKitPrintAsset("kit-1", 1)).isPresent();
    }

    @Test
    void rejectsUnsafeOrMalformedBusinessCardPdf() {
        LogoFileStorage storage = storage();
        String svg = Base64.getEncoder().encodeToString("<svg/>".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> storage.storeBrandKitPrintAsset("kit-1", 1, svg,
                Base64.getEncoder().encodeToString(minimalCardPdf("/OpenAction 5 0 R"))))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
        assertThatThrownBy(() -> storage.storeBrandKitPrintAsset("kit-1", 1, svg,
                Base64.getEncoder().encodeToString("%PDF-1.4\n%%EOF".getBytes(StandardCharsets.US_ASCII))))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
    }

    @Test
    void acceptsFlateCompressedPageDictionaryLikeCairoSvg() {
        LogoFileStorage storage = storage();
        String svg = Base64.getEncoder().encodeToString("<svg/>".getBytes(StandardCharsets.UTF_8));

        storage.storeBrandKitPrintAsset("kit-1", 1, svg,
                Base64.getEncoder().encodeToString(compressedCardPdf("/Type /Page /MediaBox [0 0 248.031 141.732]")));

        assertThat(storage.readBrandKitPrintAsset("kit-1", 1)).isPresent();
    }

    @Test
    void acceptsCairoSvgObjectStreamPdf() {
        LogoFileStorage storage = storage();
        String svg = Base64.getEncoder().encodeToString("<svg/>".getBytes(StandardCharsets.UTF_8));

        storage.storeBrandKitPrintAsset("kit-1", 1, svg, CAIROSVG_PDF_BASE64);

        assertThat(storage.readBrandKitPrintAsset("kit-1", 1)).isPresent();
    }

    @Test
    void rejectsActiveContentHiddenInsideFlateCompressedPdf() {
        LogoFileStorage storage = storage();
        String svg = Base64.getEncoder().encodeToString("<svg/>".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> storage.storeBrandKitPrintAsset("kit-1", 1, svg,
                Base64.getEncoder().encodeToString(compressedCardPdf(
                        "/Type /Page /MediaBox [0 0 248.031 141.732] /OpenAction 5 0 R"))))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
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

    private byte[] minimalCardPdf(String catalogExtra) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        List<Integer> offsets = new ArrayList<>();
        writeAscii(out, "%PDF-1.4\n");
        offsets.add(out.size());
        writeAscii(out, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R " + catalogExtra + " >>\nendobj\n");
        offsets.add(out.size());
        writeAscii(out, "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        offsets.add(out.size());
        writeAscii(out, "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 248.031 141.732] /Contents 4 0 R >>\nendobj\n");
        offsets.add(out.size());
        writeAscii(out, "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n");
        int xref = out.size();
        writeAscii(out, "xref\n0 5\n0000000000 65535 f \n");
        for (int offset : offsets) writeAscii(out, String.format("%010d 00000 n \n", offset));
        writeAscii(out, "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
        return out.toByteArray();
    }

    private byte[] compressedCardPdf(String pageDictionary) {
        ByteArrayOutputStream compressed = new ByteArrayOutputStream();
        try (DeflaterOutputStream deflater = new DeflaterOutputStream(compressed)) {
            deflater.write(pageDictionary.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            throw new AssertionError(e);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeAscii(out, "%PDF-1.7\n7 0 obj\n<< /Type /ObjStm /N 1 /First 0 /Filter /FlateDecode /Length "
                + compressed.size() + " >>\nstream\n");
        out.writeBytes(compressed.toByteArray());
        writeAscii(out, "\nendstream\nendobj\n%%EOF\n");
        return out.toByteArray();
    }

    private void writeAscii(ByteArrayOutputStream out, String value) {
        out.writeBytes(value.getBytes(StandardCharsets.US_ASCII));
    }
}
