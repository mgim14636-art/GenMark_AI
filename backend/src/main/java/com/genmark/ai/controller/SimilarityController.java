package com.genmark.ai.controller;

import com.genmark.ai.common.ApiResponse;
import com.genmark.ai.dto.request.SimilarityRequest;
import com.genmark.ai.dto.response.SimilarityResponse;
import com.genmark.ai.entity.GeneratedLogo;
import com.genmark.ai.entity.SimilarityResult;
import com.genmark.ai.service.LogoService;
import com.genmark.ai.service.SimilarityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
@RequestMapping("/similarity")
@RequiredArgsConstructor
public class SimilarityController {

    private final SimilarityService similarityService;
    private final LogoService logoService;

    @PostMapping("/check")
    @ResponseBody
    public ApiResponse<SimilarityResponse> checkSimilarity(@Valid @RequestBody SimilarityRequest request) {
        GeneratedLogo logo = logoService.getLogoById(request.getLogoId());
        List<SimilarityResult> results = similarityService.inspectSimilarity(logo);

        List<SimilarityResponse.MatchedItem> matches = results.stream()
                .map(r -> new SimilarityResponse.MatchedItem(r.getMatchedTrademarkId(), r.getMatchedTrademarkName(), r.getSimilarityScore()))
                .toList();

        SimilarityResponse response = SimilarityResponse.builder()
                .logoId(logo.getId())
                .matches(matches)
                .build();

        return ApiResponse.success("Similarity inspection complete", response);
    }

    @GetMapping("/result/{logoId}")
    public String resultPage(@PathVariable Long logoId, Model model) {
        GeneratedLogo logo = logoService.getLogoById(logoId);
        List<SimilarityResult> results = similarityService.getResultsByLogo(logoId);
        model.addAttribute("logo", logo);
        model.addAttribute("results", results);
        return "similarity/result";
    }
}
