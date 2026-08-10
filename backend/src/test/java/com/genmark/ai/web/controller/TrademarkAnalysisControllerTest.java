package com.genmark.ai.web.controller;

import com.genmark.ai.security.MemberPrincipal;
import com.genmark.ai.service.TrademarkAnalysisService;
import com.genmark.ai.service.TrademarkMatchImageService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TrademarkAnalysisControllerTest {
    @Test
    void returnsImageInlineWithDetectedContentType() {
        TrademarkAnalysisService analysisService = mock(TrademarkAnalysisService.class);
        TrademarkMatchImageService imageService = mock(TrademarkMatchImageService.class);
        byte[] jpeg = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff};
        when(imageService.load("project-1", "analysis-1", 4, 7L))
                .thenReturn(new TrademarkMatchImageService.ImageContent(jpeg, MediaType.IMAGE_JPEG, "sample.jpg"));
        TrademarkAnalysisController controller = new TrademarkAnalysisController(analysisService, imageService);

        var response = controller.matchImage(new MemberPrincipal(7L, "member@example.com"),
                "project-1", "analysis-1", 4);

        assertThat(response.getBody()).isEqualTo(jpeg);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("inline");
        verify(imageService).load("project-1", "analysis-1", 4, 7L);
    }
}
