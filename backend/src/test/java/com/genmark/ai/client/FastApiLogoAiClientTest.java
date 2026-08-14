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

class FastApiLogoAiClientTest {

    @Test
    void readsFourBase64ImagesFromFastApiGenerationResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiLogoAiClient client = new FastApiLogoAiClient(builder.build());

        server.expect(once(), requestTo("http://ai-server:8000/api/v1/generation/generate"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "logos": [
                            {"imageBase64": "logo-1", "seed": 111, "variantIndex": 0, "svg": "<svg><path/></svg>"},
                            {"imageBase64": "logo-2", "seed": 222, "variantIndex": 1},
                            {"imageBase64": "logo-3", "seed": 333, "variantIndex": 2},
                            {"imageBase64": "logo-4", "seed": 444, "variantIndex": 3}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        LogoAiClient.LogoAiResult result = client.generate(Map.of("brand_name", "GenMark"));

        assertThat(result.success()).isTrue();
        assertThat(result.logos()).containsExactly(
                new LogoAiClient.GeneratedLogo("logo-1", 111, 0, "<svg><path/></svg>"),
                new LogoAiClient.GeneratedLogo("logo-2", 222, 1, null),
                new LogoAiClient.GeneratedLogo("logo-3", 333, 2, null),
                new LogoAiClient.GeneratedLogo("logo-4", 444, 3, null));
        server.verify();
    }

    @Test
    void tolerateMissingSeedAndVariantIndex() {
        // 옛 AI 서버 응답(부가정보 없이 imageBase64만)에서도 정상 동작해야 한다.
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiLogoAiClient client = new FastApiLogoAiClient(builder.build());

        server.expect(once(), requestTo("http://ai-server:8000/api/v1/generation/generate"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        { "logos": [ {"imageBase64": "logo-1", "svg": "   "} ] }
                        """, MediaType.APPLICATION_JSON));

        LogoAiClient.LogoAiResult result = client.generate(Map.of("brand_name", "GenMark"));

        assertThat(result.logos()).containsExactly(new LogoAiClient.GeneratedLogo("logo-1", null, null, null));
        server.verify();
    }
}
