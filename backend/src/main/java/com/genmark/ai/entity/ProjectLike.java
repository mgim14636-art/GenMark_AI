package com.genmark.ai.entity;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * Common surface shared by CiProject and BiProject so the logo-generation /
 * trademark-analysis pipeline can work with either without knowing which one it got.
 */
public interface ProjectLike {
    Long getId();
    String getPublicId();
    Member getMember();
    ProjectStatus getStatus();
    void setStatus(ProjectStatus status);
    String getLogoStyle();
    String getColor1();
    String getColor2();
    String getColor3();
    String getColor4();
    Map<String, Object> toSurvey();

    default List<String> colorList() {
        return Stream.of(getColor1(), getColor2(), getColor3(), getColor4())
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toMap(
                        color -> color.toLowerCase(Locale.ROOT),
                        color -> color,
                        (first, ignored) -> first,
                        java.util.LinkedHashMap::new))
                .values().stream()
                .toList();
    }
}
