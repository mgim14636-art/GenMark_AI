package com.genmark.ai.web.dto.admin;

/** A chart bucket with optional CI/BI split values. */
public record AdminTrendPoint(String label, long value, long ci, long bi) {}
