package com.genmark.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    /** 구글/카카오 등 외부 OAuth 공급자 호출용. 서로 다른 호스트를 호출하므로 baseUrl을 두지 않는다. */
    @Bean
    public RestClient oauthRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(5_000);
        return RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }

    /** 구글/카카오 등 외부 OAuth 공급자 호출용. 서로 다른 호스트를 호출하므로 baseUrl을 두지 않는다. */
    @Bean
    public RestClient oauthRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(5_000);
        return RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }
}
