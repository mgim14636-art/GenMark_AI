package com.genmark.ai.service;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

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

        assertThat(storage.readPreferredSvg("generation-1", 1)).isEqualTo(edited.getBytes(java.nio.charset.StandardCharsets.UTF_8));
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

    private LogoFileStorage storage() {
        return new LogoFileStorage(tempDir.resolve("public").toString(),
                tempDir.resolve("private").toString(), 1_024);
    }

    private void assertUnsafe(LogoFileStorage storage, String svg) {
        assertThatThrownBy(() -> storage.storeEditedSvg("generation-1", 1, svg))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
    }
}
