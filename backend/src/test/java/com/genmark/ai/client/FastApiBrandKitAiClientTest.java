package com.genmark.ai.client;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FastApiBrandKitAiClientTest {

    @Test
    void defaultsMetadataForLegacyImageOnlyResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiBrandKitAiClient client = new FastApiBrandKitAiClient(
                builder.build(), "/api/v1/generation/brand-kit");

        server.expect(once(), requestTo("http://ai-server:8000/api/v1/generation/brand-kit"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"imageBase64": "legacy-png"}
                        """, MediaType.APPLICATION_JSON));

        BrandKitAiClient.Result result = client.generate(Map.of("kit_type", "THUMBNAIL"));

        assertThat(result.imageBase64Values()).containsExactly("legacy-png");
        assertThat(result.preliminary()).isFalse();
        assertThat(result.warnings()).isEmpty();
        server.verify();
    }

    @Test
    void readsFrontAndBackImagesFromBusinessCardResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiBrandKitAiClient client = new FastApiBrandKitAiClient(
                builder.build(), "/api/v1/generation/brand-kit");

        server.expect(once(), requestTo("http://ai-server:8000/api/v1/generation/brand-kit"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "imageBase64": "front-png",
                          "images": [
                            {"imageBase64": "front-png", "svgBase64": "front-svg", "pdfBase64": "front-pdf", "width": 1050, "height": 600},
                            {"imageBase64": "back-png", "svgBase64": "back-svg", "pdfBase64": "back-pdf", "width": 1050, "height": 600}
                          ],
                          "preliminary": true,
                          "warnings": ["AI 연출 배경 미적용"]
                        }
                        """, MediaType.APPLICATION_JSON));

        BrandKitAiClient.Result result = client.generate(Map.of("kit_type", "BUSINESS_CARD"));

        assertThat(result.imageBase64Values())
                .containsExactly("front-png", "back-png");
        assertThat(result.printAssets()).containsExactly(
                new BrandKitAiClient.PrintAsset("front-svg", "front-pdf"),
                new BrandKitAiClient.PrintAsset("back-svg", "back-pdf"));
        assertThat(result.preliminary()).isTrue();
        assertThat(result.warnings()).containsExactly("AI 연출 배경 미적용");
        server.verify();
    }
}
