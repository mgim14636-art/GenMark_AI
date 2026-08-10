package com.genmark.ai.config;

import com.genmark.ai.security.ApiAccessDeniedHandler;
import com.genmark.ai.security.ApiAuthenticationEntryPoint;
import com.genmark.ai.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ApiAuthenticationEntryPoint apiAuthenticationEntryPoint;
    private final ApiAccessDeniedHandler apiAccessDeniedHandler;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          ApiAuthenticationEntryPoint apiAuthenticationEntryPoint,
                          ApiAccessDeniedHandler apiAccessDeniedHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.apiAuthenticationEntryPoint = apiAuthenticationEntryPoint;
        this.apiAccessDeniedHandler = apiAccessDeniedHandler;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        AntPathRequestMatcher apiMatcher = new AntPathRequestMatcher("/api/v1/**");
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/css/**", "/js/**", "/images/**", "/member/**",
                                "/logo/**", "/project/**", "/similarity/**").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                        .requestMatchers("/api/v1/**").authenticated()
                        .requestMatchers("/api/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(eh -> eh
                        .defaultAuthenticationEntryPointFor(apiAuthenticationEntryPoint, apiMatcher)
                        .defaultAccessDeniedHandlerFor(apiAccessDeniedHandler, apiMatcher))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .formLogin(form -> form.loginPage("/member/login").defaultSuccessUrl("/", true).permitAll())
                .logout(logout -> logout.logoutUrl("/member/logout").logoutSuccessUrl("/").permitAll());
        return http.build();
    }
}
