package com.genmark.ai.web.dto;

import java.util.List;

public record ApiErrorBody(String code, String message, List<ApiErrorDetail> details, String requestId) {
}
