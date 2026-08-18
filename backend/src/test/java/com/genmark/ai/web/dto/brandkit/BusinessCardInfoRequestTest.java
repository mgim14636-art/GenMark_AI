package com.genmark.ai.web.dto.brandkit;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessCardInfoRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validatesRequiredNameEmailFormatAndAiFieldLengths() {
        BusinessCardInfoRequest invalid = new BusinessCardInfoRequest(
                " ", "T".repeat(41), "C".repeat(61), "P".repeat(41),
                "not-an-email", "A".repeat(121));

        var violations = validator.validate(invalid);

        assertThat(violations).extracting(violation -> violation.getPropertyPath().toString())
                .contains("name", "title", "company", "phone", "email", "address");
    }
}
