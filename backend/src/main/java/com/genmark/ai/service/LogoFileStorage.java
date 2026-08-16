package com.genmark.ai.service;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.w3c.dom.Element;
import org.w3c.dom.Document;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

@Component
public class LogoFileStorage {
    private static final Pattern EXTERNAL_CSS_URL = Pattern.compile(
            "url\\s*\\(\\s*['\"]?(?!#)", Pattern.CASE_INSENSITIVE);
    private static final Pattern SAFE_PATH_SEGMENT = Pattern.compile("[A-Za-z0-9_-]+");

    private final Path root;
    private final Path privateRoot;
    private final int maxSvgBytes;

    public LogoFileStorage(@Value("${file.upload-dir:uploads}") String uploadDir,
                           @Value("${file.private-upload-dir:private-uploads}") String privateUploadDir,
                           @Value("${app.logo-svg-max-bytes:1048576}") int maxSvgBytes) {
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
        this.privateRoot = Path.of(privateUploadDir).toAbsolutePath().normalize();
        if (this.privateRoot.startsWith(this.root)) {
            throw new IllegalArgumentException("Private SVG storage must be outside the public upload directory");
        }
        this.maxSvgBytes = maxSvgBytes;
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

    public String storeOriginalSvg(String generationPublicId, int order, String svg) {
        byte[] bytes = validateSvg(svg);
        Path file = svgPath(generationPublicId, order, false);
        try {
            Files.createDirectories(file.getParent());
            if (Files.exists(file)) {
                if (Arrays.equals(Files.readAllBytes(file), bytes)) return privateStorageKey(file);
                throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "원본 SVG는 덮어쓸 수 없습니다.");
            }
            Files.write(file, bytes, StandardOpenOption.CREATE_NEW);
            return privateStorageKey(file);
        } catch (ApiException e) {
            throw e;
        } catch (java.nio.file.FileAlreadyExistsException e) {
            try {
                if (Arrays.equals(Files.readAllBytes(file), bytes)) return privateStorageKey(file);
            } catch (IOException ignored) {
                // Fall through to the immutable-original conflict below.
            }
            throw new ApiException(ErrorCode.RESOURCE_CONFLICT, "원본 SVG는 덮어쓸 수 없습니다.");
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public String storeEditedSvg(String generationPublicId, int order, String svg) {
        byte[] bytes = validateSvg(svg);
        Path file = svgPath(generationPublicId, order, true);
        try {
            Files.createDirectories(file.getParent());
            writeAtomically(file, bytes);
            return privateStorageKey(file);
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public StoredEditedAsset storeEditedAssets(String generationPublicId, int order, String svg, String pngBase64) {
        byte[] svgBytes = validateSvg(svg);
        byte[] pngBytes = decodePng(pngBase64);
        BufferedImage image = validateEditedPng(pngBytes);
        String revision = contentRevision(svgBytes, pngBytes);
        Path svgFile = revisionSvgPath(generationPublicId, order, revision);
        Path pngFile = revisionPngPath(generationPublicId, order, revision);
        try {
            Files.createDirectories(svgFile.getParent());
            Files.createDirectories(pngFile.getParent());
            writeImmutable(svgFile, svgBytes);
            writeImmutable(pngFile, pngBytes);
            return new StoredEditedAsset(publicStorageKey(pngFile), revision,
                    image.getWidth(), image.getHeight());
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public byte[] readSvg(String generationPublicId, int order, String revision) {
        if (revision == null || revision.isBlank()) return readPreferredSvg(generationPublicId, order);
        Path file = revisionSvgPath(generationPublicId, order, revision);
        if (!Files.exists(file)) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        try {
            return Files.readAllBytes(file);
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public byte[] readPreferredSvg(String generationPublicId, int order) {
        Path edited = svgPath(generationPublicId, order, true);
        Path original = svgPath(generationPublicId, order, false);
        Path selected = Files.exists(edited) ? edited : original;
        if (!Files.exists(selected)) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        try {
            return Files.readAllBytes(selected);
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public void storeBrandKitSourceKey(String brandKitPublicId, String sourceStorageKey) {
        if (sourceStorageKey == null || sourceStorageKey.isBlank()) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
        Path file = brandKitSourcePath(brandKitPublicId);
        try {
            Files.createDirectories(file.getParent());
            writeAtomically(file, sourceStorageKey.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public boolean brandKitSourceKeyMatches(String brandKitPublicId, String sourceStorageKey) {
        if (sourceStorageKey == null || sourceStorageKey.isBlank()) return false;
        Path file = brandKitSourcePath(brandKitPublicId);
        if (!Files.exists(file)) return false;
        try {
            return sourceStorageKey.equals(Files.readString(file, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    public List<String> brandKitStorageKeys(String brandKitPublicId, String primaryStorageKey) {
        if (brandKitPublicId == null || !SAFE_PATH_SEGMENT.matcher(brandKitPublicId).matches()) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
        Path directory = root.resolve("logos").resolve("brand-kits").resolve(brandKitPublicId).normalize();
        if (!directory.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);

        List<String> storageKeys = new ArrayList<>();
        for (int order = 1; order <= 10; order += 1) {
            Path file = directory.resolve("candidate-" + order + ".png").normalize();
            if (!file.startsWith(root) || !Files.isRegularFile(file)) break;
            storageKeys.add(publicStorageKey(file));
        }
        if (storageKeys.isEmpty() && primaryStorageKey != null && !primaryStorageKey.isBlank()) {
            storageKeys.add(primaryStorageKey);
        }
        return List.copyOf(storageKeys);
    }

    public boolean brandKitHasExpectedImageCount(String brandKitPublicId, int expectedCount) {
        return brandKitStorageKeys(brandKitPublicId, null).size() >= expectedCount;
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

    private Path svgPath(String generationPublicId, int order, boolean edited) {
        if (generationPublicId == null || !SAFE_PATH_SEGMENT.matcher(generationPublicId).matches() || order < 1) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
        Path directory = privateRoot.resolve("logos").resolve(generationPublicId).normalize();
        if (!directory.startsWith(privateRoot)) throw new ApiException(ErrorCode.STORAGE_ERROR);
        String suffix = edited ? "-edited.svg" : ".svg";
        Path file = directory.resolve("candidate-" + order + suffix).normalize();
        if (!file.startsWith(privateRoot)) throw new ApiException(ErrorCode.STORAGE_ERROR);
        return file;
    }

    private Path revisionSvgPath(String generationPublicId, int order, String revision) {
        validateRevision(revision);
        Path legacy = svgPath(generationPublicId, order, false);
        return legacy.resolveSibling("candidate-" + order + "-" + revision + ".svg");
    }

    private Path revisionPngPath(String generationPublicId, int order, String revision) {
        validateRevision(revision);
        if (generationPublicId == null || !SAFE_PATH_SEGMENT.matcher(generationPublicId).matches() || order < 1) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
        Path directory = root.resolve("logos").resolve(generationPublicId).normalize();
        if (!directory.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);
        Path file = directory.resolve("candidate-" + order + "-" + revision + ".png").normalize();
        if (!file.startsWith(root)) throw new ApiException(ErrorCode.STORAGE_ERROR);
        return file;
    }

    private Path brandKitSourcePath(String brandKitPublicId) {
        if (brandKitPublicId == null || !SAFE_PATH_SEGMENT.matcher(brandKitPublicId).matches()) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
        Path directory = privateRoot.resolve("brand-kits").normalize();
        Path file = directory.resolve(brandKitPublicId + ".source-key").normalize();
        if (!file.startsWith(privateRoot)) throw new ApiException(ErrorCode.STORAGE_ERROR);
        return file;
    }

    private void validateRevision(String revision) {
        if (revision == null || !revision.matches("[0-9a-f]{64}")) {
            throw new ApiException(ErrorCode.STORAGE_ERROR);
        }
    }

    private String privateStorageKey(Path file) {
        return privateRoot.relativize(file).toString().replace('\\', '/');
    }

    private String publicStorageKey(Path file) {
        return root.relativize(file).toString().replace('\\', '/');
    }

    private byte[] validateSvg(String svg) {
        if (svg == null || svg.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "SVG 내용을 확인해 주세요.");
        }
        byte[] bytes = svg.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > maxSvgBytes) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "SVG 파일 크기가 허용 범위를 초과했습니다.");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
            if (containsProcessingInstruction(document)) throw invalidSvg();
            Element rootElement = document.getDocumentElement();
            if (rootElement == null || !"svg".equalsIgnoreCase(localName(rootElement))) {
                throw invalidSvg();
            }
            validateElement(rootElement);
            return bytes;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw invalidSvg();
        }
    }

    private BufferedImage validateEditedPng(byte[] bytes) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null || image.getWidth() != 1024 || image.getHeight() != 1024) {
                throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "SVG 래스터 변환 결과가 올바른 PNG가 아닙니다.");
            }
            return image;
        } catch (IOException e) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "SVG 래스터 변환 PNG를 읽을 수 없습니다.");
        }
    }

    private String contentRevision(byte[] svgBytes, byte[] pngBytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            updateLength(digest, svgBytes.length);
            digest.update(svgBytes);
            updateLength(digest, pngBytes.length);
            digest.update(pngBytes);
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private void updateLength(MessageDigest digest, int length) {
        digest.update((byte) (length >>> 24));
        digest.update((byte) (length >>> 16));
        digest.update((byte) (length >>> 8));
        digest.update((byte) length);
    }

    private void validateElement(Element element) {
        String tag = localName(element).toLowerCase(Locale.ROOT);
        if (tag.equals("script") || tag.equals("foreignobject")) throw invalidSvg();
        if (tag.equals("style")) validateCssValue(element.getTextContent());

        NamedNodeMap attributes = element.getAttributes();
        for (int i = 0; i < attributes.getLength(); i++) {
            Node attribute = attributes.item(i);
            String name = localName(attribute).toLowerCase(Locale.ROOT);
            String qualifiedName = attribute.getNodeName().toLowerCase(Locale.ROOT);
            String value = attribute.getNodeValue() == null ? "" : attribute.getNodeValue().trim();
            String normalizedValue = value.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
            if (name.startsWith("on") || normalizedValue.contains("javascript:")) throw invalidSvg();
            if ((name.equals("href") || qualifiedName.endsWith(":href"))
                    && !value.isEmpty() && !value.startsWith("#")) {
                throw invalidSvg();
            }
            if (EXTERNAL_CSS_URL.matcher(value).find()) throw invalidSvg();
            if (name.equals("style")) validateCssValue(value);
        }

        NodeList children = element.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            if (children.item(i) instanceof Element child) validateElement(child);
        }
    }

    private boolean containsProcessingInstruction(Node node) {
        if (node.getNodeType() == Node.PROCESSING_INSTRUCTION_NODE) return true;
        NodeList children = node.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            if (containsProcessingInstruction(children.item(i))) return true;
        }
        return false;
    }

    private void writeAtomically(Path target, byte[] bytes) throws IOException {
        Path temp = Files.createTempFile(target.getParent(), target.getFileName().toString(), ".tmp");
        try {
            Files.write(temp, bytes, StandardOpenOption.TRUNCATE_EXISTING);
            try {
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private void writeImmutable(Path target, byte[] bytes) throws IOException {
        if (Files.exists(target)) {
            if (!Arrays.equals(Files.readAllBytes(target), bytes)) throw new IOException("Revision content mismatch");
            return;
        }
        Path temp = Files.createTempFile(target.getParent(), target.getFileName().toString(), ".tmp");
        try {
            Files.write(temp, bytes, StandardOpenOption.TRUNCATE_EXISTING);
            try {
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (java.nio.file.FileAlreadyExistsException e) {
                if (!Arrays.equals(Files.readAllBytes(target), bytes)) throw e;
            } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                try {
                    Files.move(temp, target);
                } catch (java.nio.file.FileAlreadyExistsException alreadyExists) {
                    if (!Arrays.equals(Files.readAllBytes(target), bytes)) throw alreadyExists;
                }
            }
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private String localName(Node node) {
        return node.getLocalName() == null ? node.getNodeName() : node.getLocalName();
    }

    private void validateCssValue(String value) {
        String normalized = value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
        if (normalized.contains("@import") || normalized.contains("javascript:")
                || EXTERNAL_CSS_URL.matcher(value == null ? "" : value).find()) {
            throw invalidSvg();
        }
    }

    private ApiException invalidSvg() {
        return new ApiException(ErrorCode.VALIDATION_ERROR, "안전하지 않거나 올바르지 않은 SVG입니다.");
    }

    public record StoredImage(String storageKey, int width, int height) {}

    public record StoredEditedAsset(String storageKey, String revision, int width, int height) {}
}
