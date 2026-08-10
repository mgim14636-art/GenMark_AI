package com.genmark.ai.client;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
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
                            {"imageBase64": "logo-1"},
                            {"imageBase64": "logo-2"},
                            {"imageBase64": "logo-3"},
                            {"imageBase64": "logo-4"}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        LogoAiClient.LogoAiResult result = client.generate(Map.of("brand_name", "GenMark"));

        assertThat(result.success()).isTrue();
        assertThat(result.logos()).isEqualTo(List.of("logo-1", "logo-2", "logo-3", "logo-4"));
        server.verify();
    }
}
