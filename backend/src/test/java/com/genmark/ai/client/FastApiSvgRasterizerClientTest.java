package com.genmark.ai.client;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FastApiSvgRasterizerClientTest {
    @Test
    void rasterizesSvgThroughFastApi() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiSvgRasterizerClient client = new FastApiSvgRasterizerClient(builder.build());
        server.expect(once(), requestTo("http://ai-server:8000/api/v1/generation/rasterize-svg"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"svg\":\"<svg/>\"}"))
                .andRespond(withSuccess("{\"imageBase64\":\"png-base64\"}", MediaType.APPLICATION_JSON));

        assertThat(client.rasterize("<svg/>")).isEqualTo("png-base64");
        server.verify();
    }
}
