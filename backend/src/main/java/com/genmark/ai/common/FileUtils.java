package com.genmark.ai.common;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

public class FileUtils {

    public static String saveFile(String uploadDir, String originalFilename, byte[] content) throws IOException {
        Path dirPath = Paths.get(uploadDir);
        if (!Files.exists(dirPath)) {
            Files.createDirectories(dirPath);
        }

        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        } else {
            extension = ".png";
        }

        String savedFilename = UUID.randomUUID().toString() + extension;
        Path filePath = dirPath.resolve(savedFilename);
        Files.write(filePath, content);

        return savedFilename;
    }
}
