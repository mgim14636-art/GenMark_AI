package com.genmark.ai.web.controller;

import com.genmark.ai.service.AdminSimilarityService;
import com.genmark.ai.web.dto.ApiSuccessResponse;
import com.genmark.ai.web.dto.admin.AdminSimilarityCompareRequest;
import com.genmark.ai.web.dto.admin.AdminSimilarityCompareResponse;
import com.genmark.ai.web.dto.admin.AdminSimilarityVectorRow;
import com.genmark.ai.web.dto.admin.AdminVectorizeRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 전용 "유사도 관리 및 테스트" — 자체 생성 로고 벡터화와 1:1 비교.
 *
 * <p>{@code /api/v1/admin/**}는 SecurityConfig에서 {@code hasRole("ADMIN")}으로 막혀 있다.
 */
@RestController
@RequestMapping("/api/v1/admin/similarity-vectors")
@RequiredArgsConstructor
public class AdminSimilarityController {

    private final AdminSimilarityService adminSimilarityService;

    /** 생성 로고 목록의 "벡터화" 버튼. 이미 벡터화된 로고면 기존 기록을 그대로 돌려준다. */
    @PostMapping
    public ResponseEntity<ApiSuccessResponse<AdminSimilarityVectorRow>> vectorize(
            @RequestBody AdminVectorizeRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(adminSimilarityService.vectorize(request.candidateId())));
    }

    /** 지금까지 벡터화된 자체 생성 로고 목록. */
    @GetMapping
    public ResponseEntity<ApiSuccessResponse<List<AdminSimilarityVectorRow>>> list() {
        return ResponseEntity.ok(ApiSuccessResponse.of(adminSimilarityService.list()));
    }

    /** 벡터화된 로고(왼쪽)와 업로드한 비교 이미지(오른쪽)를 1:1로 비교한다. 기록하지 않는다. */
    @PostMapping("/{id}/compare")
    public ResponseEntity<ApiSuccessResponse<AdminSimilarityCompareResponse>> compare(
            @PathVariable Long id, @RequestBody AdminSimilarityCompareRequest request) {
        return ResponseEntity.ok(ApiSuccessResponse.of(
                adminSimilarityService.compare(id, request.imageBase64())));
    }
}
