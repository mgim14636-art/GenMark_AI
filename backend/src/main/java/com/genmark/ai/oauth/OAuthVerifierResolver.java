package com.genmark.ai.oauth;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class OAuthVerifierResolver {

    private final Map<String, OAuthVerifier> verifiersByProvider;

    public OAuthVerifierResolver(List<OAuthVerifier> verifiers) {
        this.verifiersByProvider = verifiers.stream()
                .collect(Collectors.toMap(OAuthVerifier::provider, Function.identity()));
    }

    public OAuthVerifier resolve(String provider) {
        OAuthVerifier verifier = verifiersByProvider.get(provider);
        if (verifier == null) {
            throw new ApiException(ErrorCode.PROVIDER_NOT_SUPPORTED, "지원하지 않는 provider입니다: " + provider);
        }
        return verifier;
    }
}
