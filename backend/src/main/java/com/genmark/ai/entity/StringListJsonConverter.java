package com.genmark.ai.entity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class StringListJsonConverter implements AttributeConverter<List<String>, String> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<String> values) {
        try {
            return OBJECT_MAPPER.writeValueAsString(values == null ? List.of() : values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("경고 목록을 JSON으로 저장할 수 없습니다.", ex);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> values = OBJECT_MAPPER.readValue(json, STRING_LIST);
            return values == null ? List.of() : List.copyOf(values);
        } catch (Exception ex) {
            throw new IllegalArgumentException("저장된 경고 목록 JSON을 읽을 수 없습니다.", ex);
        }
    }
}
