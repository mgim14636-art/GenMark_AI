package com.genmark.ai.service;

import com.genmark.ai.client.AiServerClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiServerService {

    private final AiServerClient aiServerClient;

    public String requestLogoGeneration(String prompt) {
        try {
            Map<String, Object> response = aiServerClient.generateLogo(prompt);
            return (String) response.getOrDefault("image_url", "/images/logo/generated-placeholder.png");
        } catch (Exception e) {
            return "/images/logo/generated-placeholder.png";
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> requestSimilarityCheck(String imageUrl) {
        try {
            Map<String, Object> response = aiServerClient.checkSimilarity(imageUrl);
            return (List<Map<String, Object>>) response.getOrDefault("matches", Collections.emptyList());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
