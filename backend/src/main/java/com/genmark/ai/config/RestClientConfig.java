package com.genmark.ai.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient aiRestClient(@Value("${ai.server.url:http://localhost:8000}") String baseUrl) {
        return RestClient.builder().requestFactory(aiRequestFactory()).baseUrl(baseUrl).build();
    }

    @Bean
    public RestClient logoAiRestClient(@Value("${logo.ai.server.url:http://localhost:5000}") String baseUrl) {
        return RestClient.builder().requestFactory(aiRequestFactory()).baseUrl(baseUrl).build();
    }

    @Bean
    public RestClient oauthRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(5_000);
        return RestClient.builder().requestFactory(requestFactory).build();
    }

    private SimpleClientHttpRequestFactory aiRequestFactory() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(120_000);
        return requestFactory;
    }
}
