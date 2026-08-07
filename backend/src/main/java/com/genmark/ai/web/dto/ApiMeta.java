package com.genmark.ai.web.dto;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** API_SPEC.md 2.2/2.3 공통 응답의 meta 필드. */
public record ApiMeta(String requestId, String timestamp) {

    public static ApiMeta now() {
        String requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String timestamp = Instant.now().truncatedTo(ChronoUnit.SECONDS).toString();
        return new ApiMeta(requestId, timestamp);
    }
}
