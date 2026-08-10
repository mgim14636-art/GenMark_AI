package com.genmark.ai.service;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Base64;

@Component
public class LogoFileStorage {
    private final Path root;

    public LogoFileStorage(@Value("${file.upload-dir:uploads}") String uploadDir) {
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public StoredImage store(String generationPublicId, int order, String base64) {
        byte[] bytes = decodePng(base64);
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "AI 결과가 PNG 이미지가 아닙니다.");
            Path directory = root.resolve("logos").resolve(generationPublicId).normalize();
            if (!directory.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);
            Files.createDirectories(directory);
            Path file = directory.resolve("candidate-" + order + ".png");
            Files.write(file, bytes);
            String storageKey = root.relativize(file).toString().replace('\\', '/');
            return new StoredImage(storageKey, image.getWidth(), image.getHeight());
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public byte[] read(String storageKey) {
        try {
            Path file = root.resolve(storageKey).normalize();
            if (!file.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);
            return Files.readAllBytes(file);
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    /**
     * 사용자가 다운로드한 로고를 보관 영역(downloads/)으로 복사한다.
     *
     * <p>원본(logos/)은 생성 결과 전체를 담고 있어 언젠가 정리 대상이 될 수 있다. 다운로드한
     * 로고는 관리자 통계에서 계속 보여줘야 하므로 별도 경로에 사본을 둔다.
     *
     * @return 보관본의 storageKey
     */
    public String archiveForDownload(Long memberId, String candidatePublicId, String sourceStorageKey) {
        try {
            Path source = root.resolve(sourceStorageKey).normalize();
            if (!source.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);

            Path directory = root.resolve("downloads").resolve(String.valueOf(memberId)).normalize();
            if (!directory.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);
            Files.createDirectories(directory);

            Path target = directory.resolve(candidatePublicId + ".png");
            Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
            return root.relativize(target).toString().replace('\\', '/');
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    /**
     * 보관본 파일을 지운다. 보관 한도(CI 20 / BI 20)를 넘겨 오래된 기록을 정리할 때 쓴다.
     *
     * <p>파일이 이미 없어도 예외를 던지지 않는다. 목표는 "없는 상태"이므로 이미 없으면 성공이다.
     */
    public void deleteQuietly(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        try {
            Path file = root.resolve(storageKey).normalize();
            if (!file.startsWith(root)) return;
            Files.deleteIfExists(file);
        } catch (IOException e) {
            // 파일 삭제 실패가 DB 정리까지 막으면 안 된다. 다음 정리 때 다시 시도된다.
        }
    }

    private byte[] decodePng(String value) {
        if (value == null || value.isBlank()) throw new ApiException(ErrorCode.AI_INVALID_RESPONSE);
        int comma = value.indexOf(',');
        String raw = value.startsWith("data:") && comma >= 0 ? value.substring(comma + 1) : value;
        try {
            byte[] bytes = Base64.getDecoder().decode(raw);
            if (bytes.length < 8 || bytes[0] != (byte) 0x89 || bytes[1] != 0x50
                    || bytes[2] != 0x4E || bytes[3] != 0x47) {
                throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "AI 결과가 PNG 형식이 아닙니다.");
            }
            return bytes;
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "AI 이미지 Base64를 해석할 수 없습니다.");
        }
    }

    public record StoredImage(String storageKey, int width, int height) {}
}
