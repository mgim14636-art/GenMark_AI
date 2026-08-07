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
