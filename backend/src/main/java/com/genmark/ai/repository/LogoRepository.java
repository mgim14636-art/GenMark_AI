package com.genmark.ai.repository;

import com.genmark.ai.entity.GeneratedLogo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LogoRepository extends JpaRepository<GeneratedLogo, Long> {
    List<GeneratedLogo> findByProjectId(Long projectId);
}
