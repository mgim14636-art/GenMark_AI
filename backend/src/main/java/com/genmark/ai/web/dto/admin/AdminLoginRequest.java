package com.genmark.ai.web.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminLoginRequest(
        @NotBlank(message = "loginId는 필수입니다.") @Size(max = 50) String loginId,
        @NotBlank(message = "password는 필수입니다.") @Size(max = 100) String password
) {}
