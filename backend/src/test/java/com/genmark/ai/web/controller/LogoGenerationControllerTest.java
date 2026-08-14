package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.LogoGenerationService;
import com.genmark.ai.service.LogoSvgService;
import com.genmark.ai.web.dto.logo.LogoSvgUpdateRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class LogoGenerationControllerTest {
    @Test
    void returnsSvgAsAttachmentWithNosniff() {
        LogoGenerationService generationService = mock(LogoGenerationService.class);
        LogoSvgService svgService = mock(LogoSvgService.class);
        LogoGenerationController controller = new LogoGenerationController(generationService, svgService);
        byte[] svg = "<svg/>".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(svgService.read("project-1", "candidate-1", 7L)).thenReturn(svg);

        var response = controller.svg(new MemberPrincipal(7L, "member@example.com"),
                "project-1", "candidate-1");

        assertThat(response.getBody()).isEqualTo(svg);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.valueOf("image/svg+xml"));
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("attachment");
    }

    @Test
    void storesEditedSvg() {
        LogoSvgService svgService = mock(LogoSvgService.class);
        LogoGenerationController controller = new LogoGenerationController(mock(LogoGenerationService.class), svgService);

        var response = controller.updateSvg(new MemberPrincipal(7L, "member@example.com"),
                "project-1", "candidate-1", new LogoSvgUpdateRequest("<svg/>"));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(svgService).saveEdited("project-1", "candidate-1", 7L, "<svg/>");
    }
}
