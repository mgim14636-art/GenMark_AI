package com.genmark.ai.client;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FastApiTrademarkAiClientTest {

    @Test
    void acceptsTwoMatchesWhenTopKIsThree() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiTrademarkAiClient client = new FastApiTrademarkAiClient(builder.build());
        server.expect(once(), requestTo("http://ai-server:8000/api/v1/similarity/search"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(responseWithMatches("""
                        {"applicationNumber":"1","name":"first","category":"42","similarity":50,"imagePath":"a.png","note":"외곽선이 유사함"},
                        {"applicationNumber":"2","name":"second","category":"42","similarity":40,"imagePath":"b.png"}
                        """), MediaType.APPLICATION_JSON));

        TrademarkAiClient.Result result = client.search("image", "combination", 3);

        assertThat(result.matches()).hasSize(2);
        assertThat(result.matches().get(0).note()).isEqualTo("외곽선이 유사함");
        assertThat(result.matches().get(1).note()).isNull();
        server.verify();
    }

    @Test
    void rejectsEmptyMatches() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiTrademarkAiClient client = new FastApiTrademarkAiClient(builder.build());
        server.expect(once(), requestTo("http://ai-server:8000/api/v1/similarity/search"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(responseWithMatches(""), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.search("image", "combination", 3))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
        server.verify();
    }

    @Test
    void rejectsMoreMatchesThanRequested() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai-server:8000");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        FastApiTrademarkAiClient client = new FastApiTrademarkAiClient(builder.build());
        server.expect(once(), requestTo("http://ai-server:8000/api/v1/similarity/search"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(responseWithMatches("""
                        {"applicationNumber":"1","name":"first","category":"42","similarity":50,"imagePath":"a.png"},
                        {"applicationNumber":"2","name":"second","category":"42","similarity":40,"imagePath":"b.png"},
                        {"applicationNumber":"3","name":"third","category":"42","similarity":30,"imagePath":"c.png"},
                        {"applicationNumber":"4","name":"fourth","category":"42","similarity":20,"imagePath":"d.png"}
                        """), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.search("image", "combination", 3))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.AI_INVALID_RESPONSE));
        server.verify();
    }

    private String responseWithMatches(String matches) {
        return """
                {
                  "maxSimilarity": 50,
                  "riskLevel": "MODERATE",
                  "disclaimer": "notice",
                  "matches": [%s]
                }
                """.formatted(matches);
    }
}
