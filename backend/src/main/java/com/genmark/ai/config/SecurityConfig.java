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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    /**
     * 관리자 비밀번호 검증용. 일반 회원은 소셜 로그인만 쓰므로 비밀번호가 없고,
     * 이 인코더는 admins 테이블에만 쓰인다.
     *
     * <p>관리자 계정을 DB에 직접 INSERT할 때 넣을 해시도 이 방식(BCrypt)으로 만들어야 한다.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        AntPathRequestMatcher apiMatcher = new AntPathRequestMatcher("/api/v1/**");
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/css/**", "/js/**", "/images/**", "/uploads/**", "/member/**",
                                "/logo/**", "/project/**", "/similarity/**").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                        // 관리자 로그인은 토큰 없이 들어와야 하므로 열어둔다.
                        .requestMatchers("/api/v1/admin/auth/**").permitAll()
                        // 나머지 관리자 API는 admins 테이블로 발급된 토큰(ROLE_ADMIN)만 통과한다.
                        // 일반 회원 토큰은 authorities가 비어 있어 여기서 403으로 막힌다.
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
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
