package com.genmark.ai.web.dto.brandkit;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BusinessCardInfoRequest(
        @NotBlank(message = "이름은 필수입니다.") @Size(max = 40) String name,
        @Size(max = 40) String title,
        @Size(max = 60) String company,
        @Size(max = 40) String phone,
        @Email(message = "이메일 형식을 확인해 주세요.") @Size(max = 80) String email,
        @Size(max = 120) String address
) {}
