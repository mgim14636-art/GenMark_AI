package com.genmark.ai.service;

import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.entity.TrademarkMatch;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.repository.TrademarkMatchRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

@Service
@Transactional(readOnly = true)
public class TrademarkMatchImageService {
    private final ProjectLookupService projectLookup;
    private final TrademarkAnalysisRepository analysisRepository;
    private final TrademarkMatchRepository matchRepository;
    private final Path imageRoot;
    private final long maxImageBytes;

    public TrademarkMatchImageService(ProjectLookupService projectLookup,
                                      TrademarkAnalysisRepository analysisRepository,
                                      TrademarkMatchRepository matchRepository,
                                      @Value("${app.trademark-image-root}") String imageRoot,
                                      @Value("${app.trademark-image-max-bytes}") long maxImageBytes) {
        if (maxImageBytes <= 0 || maxImageBytes > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("app.trademark-image-max-bytes must be between 1 and 2147483647");
        }
        this.projectLookup = projectLookup;
        this.analysisRepository = analysisRepository;
        this.matchRepository = matchRepository;
        this.imageRoot = Path.of(imageRoot).toAbsolutePath().normalize();
        this.maxImageBytes = maxImageBytes;
    }

    public ImageContent load(String projectId, String analysisId, int rank, Long memberId) {
        projectLookup.requireOwned(projectId, memberId);
        TrademarkAnalysis analysis = analysisRepository.findByPublicIdAndCandidateGenerationCiProjectMemberId(analysisId, memberId)
                .or(() -> analysisRepository.findByPublicIdAndCandidateGenerationBiProjectMemberId(analysisId, memberId))
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        if (!analysis.getProject().getPublicId().equals(projectId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        TrademarkMatch match = matchRepository.findByAnalysisIdAndRank(analysis.getId(), rank)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        Path image = resolveImage(match.getImagePath());
        try (FileChannel channel = FileChannel.open(image, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)) {
            long size = channel.size();
            if (size <= 0 || size > maxImageBytes) {
                throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
            }
            byte[] header = readHeader(channel, size);
            MediaType contentType = detectContentType(header);
            byte[] bytes = readBody(channel, (int) size);
            return new ImageContent(bytes, contentType, image.getFileName().toString());
        } catch (IOException | SecurityException exception) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    private Path resolveImage(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        try {
            Path image = imageRoot.resolve(storedPath).normalize();
            if (!image.startsWith(imageRoot)) {
                throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
            }
            Path realRoot = imageRoot.toRealPath();
            Path realImage = image.toRealPath();
            if (!realImage.startsWith(realRoot)
                    || !Files.isRegularFile(image, LinkOption.NOFOLLOW_LINKS)
                    || !Files.isReadable(image)) {
                throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
            }
            return image;
        } catch (InvalidPathException | IOException | SecurityException exception) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
    }

    private byte[] readHeader(FileChannel channel, long size) throws IOException {
        ByteBuffer header = ByteBuffer.allocate((int) Math.min(8, size));
        while (header.hasRemaining()) {
            if (channel.read(header) < 0) {
                throw new IOException("Image file ended while reading its header");
            }
        }
        return header.array();
    }

    private byte[] readBody(FileChannel channel, int size) throws IOException {
        ByteBuffer body = ByteBuffer.allocate(size);
        channel.position(0);
        while (body.hasRemaining()) {
            if (channel.read(body) < 0) {
                throw new IOException("Image file ended while reading its body");
            }
        }
        return body.array();
    }

    private MediaType detectContentType(byte[] bytes) {
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47
                && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a) {
            return MediaType.IMAGE_PNG;
        }
        if (bytes.length >= 3
                && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) {
            return MediaType.IMAGE_JPEG;
        }
        throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
    }

    public record ImageContent(byte[] bytes, MediaType contentType, String filename) {}
}
