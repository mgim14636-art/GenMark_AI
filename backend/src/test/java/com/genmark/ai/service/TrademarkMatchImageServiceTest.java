package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.LogoCandidateRepository;
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

    private final ProjectLookupService projectLookup = mock(ProjectLookupService.class);
    private final TrademarkAnalysisRepository analysisRepository = mock(TrademarkAnalysisRepository.class);
    private final TrademarkMatchRepository matchRepository = mock(TrademarkMatchRepository.class);
    private final LogoCandidateRepository candidateRepository = mock(LogoCandidateRepository.class);
    private final LogoFileStorage storage = mock(LogoFileStorage.class);
    private TrademarkMatchImageService service;

    @BeforeEach
    void setUp() {
        service = new TrademarkMatchImageService(projectLookup, analysisRepository, matchRepository,
                candidateRepository, storage, imageRoot.toString(), MAX_IMAGE_BYTES);
    }

    @Test
    void loadsOwnedMatchImageBytesAndContentType() throws Exception {
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        Path image = imageRoot.resolve("raw/sample.png");
        Files.createDirectories(image.getParent());
        Files.write(image, png);
        stubOwnedMatch("project-1", "raw/sample.png");

        TrademarkMatchImageService.ImageContent result = service.load("project-1", "analysis-1", 2, 7L);

        assertThat(result.bytes()).isEqualTo(png);
        assertThat(result.contentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(result.filename()).isEqualTo("sample.png");
        verify(projectLookup).requireOwned("project-1", 7L);
        verify(analysisRepository).findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L);
        verify(matchRepository).findByAnalysisIdAndRank(11L, 2);
    }

    @Test
    void detectsJpegFromFileHeader() throws Exception {
        byte[] jpeg = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0x00};
        Path image = imageRoot.resolve("raw/sample.bin");
        Files.createDirectories(image.getParent());
        Files.write(image, jpeg);
        stubOwnedMatch("project-1", "raw/sample.bin");

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
        stubOwnedMatch("project-1", "raw/oversized.png");
        service = new TrademarkMatchImageService(projectLookup, analysisRepository, matchRepository,
                candidateRepository, storage, imageRoot.toString(), 8);

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsMalformedImageMagic() throws Exception {
        Path image = imageRoot.resolve("raw/not-image.png");
        Files.createDirectories(image.getParent());
        Files.write(image, new byte[] {0x01, 0x02, 0x03, 0x04});
        stubOwnedMatch("project-1", "raw/not-image.png");

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
        stubOwnedMatch("project-1", "raw/link.png");

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void loadsGeneratedMatchFromCandidateStorageInsteadOfImageRoot() {
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        TrademarkAnalysis analysis = analysisFor("project-1");
        TrademarkMatch match = TrademarkMatch.builder().analysis(analysis).rank(2)
                .imagePath("candidate-xyz").source(TrademarkMatch.Source.GENERATED).build();
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 2)).thenReturn(Optional.of(match));
        LogoCandidate candidate = LogoCandidate.builder().publicId("candidate-xyz")
                .storageKey("logos/candidate-xyz.png").build();
        when(candidateRepository.findByPublicId("candidate-xyz")).thenReturn(Optional.of(candidate));
        when(storage.read("logos/candidate-xyz.png")).thenReturn(png);

        TrademarkMatchImageService.ImageContent result = service.load("project-1", "analysis-1", 2, 7L);

        assertThat(result.bytes()).isEqualTo(png);
        assertThat(result.contentType()).isEqualTo(MediaType.IMAGE_PNG);
    }

    @Test
    void generatedMatchWithMissingCandidateReturnsNotFound() {
        TrademarkAnalysis analysis = analysisFor("project-1");
        TrademarkMatch match = TrademarkMatch.builder().analysis(analysis).rank(2)
                .imagePath("gone").source(TrademarkMatch.Source.GENERATED).build();
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 2)).thenReturn(Optional.of(match));
        when(candidateRepository.findByPublicId("gone")).thenReturn(Optional.empty());

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsAnalysisFromAnotherProjectBeforeMatchLookup() {
        TrademarkAnalysis analysis = analysisFor("project-2");
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));

        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));

        verify(matchRepository, never()).findByAnalysisIdAndRank(anyLong(), anyInt());
    }

    @Test
    void rejectsRankThatDoesNotBelongToAnalysis() {
        TrademarkAnalysis analysis = analysisFor("project-1");
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 99)).thenReturn(Optional.empty());

        assertNotFound(() -> service.load("project-1", "analysis-1", 99, 7L));
    }

    @Test
    void returnsNotFoundForMissingImageFile() {
        stubOwnedMatch("project-1", "raw/missing.jpg");
        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    @Test
    void rejectsPathTraversalOutsideConfiguredRoot() {
        stubOwnedMatch("project-1", "../outside.png");
        assertNotFound(() -> service.load("project-1", "analysis-1", 2, 7L));
    }

    private TrademarkAnalysis analysisFor(String projectPublicId) {
        CiProject project = CiProject.builder().publicId(projectPublicId).build();
        LogoGeneration generation = LogoGeneration.builder().ciProject(project).build();
        LogoCandidate candidate = LogoCandidate.builder().generation(generation).build();
        return TrademarkAnalysis.builder().id(11L).publicId("analysis-1").candidate(candidate).build();
    }

    private void stubOwnedMatch(String projectPublicId, String imagePath) {
        TrademarkAnalysis analysis = analysisFor(projectPublicId);
        TrademarkMatch match = TrademarkMatch.builder().analysis(analysis).rank(2).imagePath(imagePath).build();
        when(analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId("analysis-1", 7L))
                .thenReturn(Optional.of(analysis));
        when(matchRepository.findByAnalysisIdAndRank(11L, 2)).thenReturn(Optional.of(match));
    }

    private void assertNotFound(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action)
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }
}
