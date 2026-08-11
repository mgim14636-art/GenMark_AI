package com.genmark.ai.repository;

import com.genmark.ai.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByLoginId(String loginId);
}
