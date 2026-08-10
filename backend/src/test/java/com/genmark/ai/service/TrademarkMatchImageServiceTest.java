package com.genmark.ai.service;

import com.genmark.ai.entity.Project;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class TrademarkMatchImageServiceTest {
    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    @TempDir Path imageRoot;

    private final ProjectService projectService = mock(ProjectService.class);
    private final TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
    private final TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
    private TrademarkMatchImageService service;

    @BeforeEach
    void setUp() {
        service = new TrademarkMatchImageService(projectService, analysisRepository, matchRepository,
                imageRoot.toString(), MAX_IMAGE_BYTES);
    }

    @Test
    void loadsOwnedMatchImageBytesAndContentType() throws Exception {
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        Path image = imageRoot.resolve("raw/sample.png");
        Files.createDirectories(image.getParent());
        Files.write(image, png);
        stubOwnedMatch("raw/sample.png");

        TrademarkMatchImageService.ImageContent result = service.load("project-1", "analysis-1", 2, 7L);

        assertThat(result.bytes()).isEqualTo(png);
        assertThat(result.contentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(result.filename()).isEqualTo("sample.png");
        verify(projectService).requireOwned("project-1", 7L);
        verify(analysisRepository).findByPublicIdAndProjectMemberId("analysis-1", 7L);
        verify(matchRepository).findByAnalysisIdAndRank(11L, 2);
    }

    @Test
    void detectsJpegFromFileHeader() throws Exception {
        byte[] jpeg = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0x00};
        Path image = imageRoot.resolve("raw/sample.bin");
        Files.createDirectories(image.getParent());
        Files.write(image, jpeg);
        stubOwnedMatch("raw/sample.bin");

        TrademarkMatchImageService.ImageContent result = service.load("project-1", "analysis-1", 2, 7L);

        assertThat(result.bytes()).isEqualTo(jpeg);
        assertThat(result.contentType()).isEqualTo(MediaType.IMAGE_JPEG);
    }

    @Test
    void rejectsOversizedImageBeforeReadingBody() throws Exception {
        byte[] oversized = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00};
        Path image = imageRoot.resolve("raw/oversized.png");
        Files.createDirectories(image.getParent());
        Files.write(image, oversized);
        stubOwnedMatch("raw/oversized.png");
        service = new TrademarkMatchImageService(projectService, analysisRepository, matchRepository,
                imageRoot.toString(), 8);

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsMalformedImageMagic() throws Exception {
        Path image = imageRoot.resolve("raw/not-image.png");
        Files.createDirectories(image.getParent());
        Files.write(image, new byte[] {0x01, 0x02, 0x03, 0x04});
        stubOwnedMatch("raw/not-image.png");

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsSymbolicLinkImageWhenSupported() throws Exception {
        Path target = imageRoot.resolve("raw/target.png");
        Path link = imageRoot.resolve("raw/link.png");
        Files.createDirectories(target.getParent());
        Files.write(target, new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
        try {
            Files.createSymbolicLink(link, target.getFileName());
        } catch (UnsupportedOperationException | java.io.IOException | SecurityException exception) {
            org.junit.jupiter.api.Assumptions.abort("Symbolic links are unavailable: " + exception.getMessage());
        }
        stubOwnedMatch("raw/link.png");

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsAnalysisFromAnotherProjectBeforeMatchLookup() {
        Project project = Project.builder().publicId("project-2").build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(11L).publicId("analysis-1").project(project).build();
        when(analysisRepository.findByPublicIdAndProjectMemberId("analysis-1", 7L)).thenReturn(Optional.of(analysis));

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));

        verify(matchRepository, never()).findByAnalysisIdAndRank(anyLong(), anyInt());
    }

    @Test
    void rejectsRankThatDoesNotBelongToAnalysis() {
        Project project = Project.builder().publicId("project-1").build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(11L).publicId("analysis-1").project(project).build();
        when(analysisRepository.findByPublicIdAndProjectMemberId("analysis-1", 7L)).thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 99)).thenReturn(Optional.empty());

        assertNotFound(() -> service.load("project-1", "analysis-1", 99, 7L));
    }

    @Test
    void returnsNotFoundForMissingImageFile() {
        stubOwnedMatch("raw/missing.jpg");
        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsPathTraversalOutsideConfiguredRoot() {
        stubOwnedMatch("../outside.png");
        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    private void stubOwnedMatch(String imagePath) {
        Project project = Project.builder().publicId("project-1").build();
        TrademarkAnalysis analysis = TrademarkAnalysis.builder().id(11L).publicId("analysis-1").project(project).build();
        TrademarkMatch match = TrademarkMatch.builder().analysis(analysis).rank(2).imagePath(imagePath).build();
        when(analysisRepository.findByPublicIdAndProjectMemberId("analysis-1", 7L)).thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 2)).thenReturn(Optional.of(match));
    }

    private void assertNotFound(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action)
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }
}
