package com.genmark.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.Admin;
import com.genmark.ai.entity.BiProject;
import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.CreditHistory;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberOnboarding;
import com.genmark.ai.entity.MemberSurvey;
import com.genmark.ai.entity.ProjectLike;
import com.genmark.ai.entity.TrademarkAnalysis;
import com.genmark.ai.repository.AdminRepository;
import com.genmark.ai.repository.BiProjectRepository;
import com.genmark.ai.repository.CiProjectRepository;
import com.genmark.ai.repository.CreditHistoryRepository;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.LogoGenerationRepository;
import com.genmark.ai.repository.MemberOnboardingRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.repository.TrademarkAnalysisRepository;
import com.genmark.ai.web.dto.admin.AdminAccountRow;
import com.genmark.ai.web.dto.admin.AdminAnalyticsResponse;
import com.genmark.ai.web.dto.admin.AdminLogoAsset;
import com.genmark.ai.web.dto.admin.AdminLogoMemberRow;
import com.genmark.ai.web.dto.admin.AdminMetricPoint;
import com.genmark.ai.web.dto.admin.AdminSurveyResponseRow;
import com.genmark.ai.web.dto.admin.AdminTrendPoint;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * 관리자 화면에 표시할 기간별 실데이터를 한 곳에서 집계한다.
 *
 * <p>현재 데이터 규모에서는 JPA 엔티티를 읽어 집계하는 방식으로 구현해 쿼리와 화면의
 * 의미가 어긋나지 않도록 했다. 추후 데이터가 커지면 같은 응답 계약을 유지한 채 native
 * aggregate query로 교체할 수 있다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final Set<String> VALID_PERIODS = Set.of("daily", "weekly", "monthly", "custom");
    private static final List<String> DEFAULT_SURVEY_CATEGORIES = List.of(
            "로고 생성 시간이 오래 걸려서 불편함", "원하는 느낌/스타일의 로고가 잘 안 나옴", "로고 수정이 어렵거나 마음대로 안 됨",
            "브랜드 키트·명함 만들기 기능이 아쉬움", "유사 상표 확인 결과를 얼마나 믿어야 할지 모르겠음", "기타 사항");

    private final AdminRepository adminRepository;
    private final BiProjectRepository biProjectRepository;
    private final CiProjectRepository ciProjectRepository;
    private final CreditHistoryRepository creditHistoryRepository;
    private final LogoCandidateRepository candidateRepository;
    private final LogoDownloadRepository downloadRepository;
    private final LogoGenerationRepository generationRepository;
    private final MemberOnboardingRepository onboardingRepository;
    private final MemberRepository memberRepository;
    private final MemberSurveyRepository surveyRepository;
    private final TrademarkAnalysisRepository trademarkAnalysisRepository;
    private final LogoFileStorage fileStorage;
    private final ObjectMapper objectMapper;

    public AdminAnalyticsResponse analytics(String period, LocalDate customFrom, LocalDate customTo) {
        Range range = Range.resolve(period, customFrom, customTo);
        List<Bucket> buckets = buckets(range);
        List<Member> members = memberRepository.findAll();
        List<CiProject> ciProjects = ciProjectRepository.findAll();
        List<BiProject> biProjects = biProjectRepository.findAll();
        List<LogoGeneration> generations = generationRepository.findAll();
        List<LogoDownload> downloads = downloadRepository.findAll();
        List<MemberOnboarding> onboardings = onboardingRepository.findAll();
        List<MemberSurvey> surveys = surveyRepository.findAll();
        List<CreditHistory> creditHistories = creditHistoryRepository.findAll();
        List<TrademarkAnalysis> analyses = trademarkAnalysisRepository.findAll();

        List<LogoGeneration> periodGenerations = generations.stream()
                .filter(g -> inRange(g.getCreatedAt(), range))
                .toList();
        List<LogoGeneration> succeededGenerations = periodGenerations.stream()
                .filter(g -> g.getStatus() == LogoGeneration.Status.SUCCEEDED)
                .toList();
        List<LogoGeneration> failedGenerations = periodGenerations.stream()
                .filter(g -> g.getStatus() == LogoGeneration.Status.FAILED)
                .toList();
        List<LogoDownload> periodDownloads = downloads.stream()
                .filter(d -> inRange(d.getDownloadedAt(), range))
                .toList();
        List<Member> newMembers = members.stream()
                .filter(m -> inRange(m.getCreatedAt(), range))
                .toList();
        Set<Long> startedMemberIds = periodGenerations.stream()
                .map(this::memberIdOf)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        long ciGenerations = countType(succeededGenerations, LogoDownload.ProjectType.CI);
        long biGenerations = countType(succeededGenerations, LogoDownload.ProjectType.BI);
        long ciDownloads = periodDownloads.stream().filter(d -> d.getProjectType() == LogoDownload.ProjectType.CI).count();
        long biDownloads = periodDownloads.stream().filter(d -> d.getProjectType() == LogoDownload.ProjectType.BI).count();

        SurveyStats surveyStats = surveyStats(surveys, range);
        List<AdminMetricPoint> onboardingUsage = onboardingUsage(onboardings, range);
        List<AdminMetricPoint> purpose = onboardingUsage;
        List<AdminMetricPoint> ciInputs = topInputs(ciProjects.stream()
                .filter(p -> inRange(p.getCreatedAt(), range))
                .map(CiProject::getCoreValues)
                .toList());
        List<AdminMetricPoint> biInputs = topInputs(biProjects.stream()
                .filter(p -> inRange(p.getCreatedAt(), range))
                .flatMap(p -> java.util.stream.Stream.of(p.getValueCategory1(), p.getValueCategory2(), p.getValueCategory3()))
                .toList());

        long trademarkUses = analyses.stream()
                .filter(a -> inRange(a.getCreatedAt(), range))
                .filter(a -> a.getStatus() == TrademarkAnalysis.Status.SUCCEEDED)
                .count();
        int satisfactionPercent = percentage(surveyStats.likes, surveyStats.likes + surveyStats.dislikes);
        int trademarkUsagePercent = percentage(trademarkUses, succeededGenerations.size());

        CreditStats creditStats = creditStats(creditHistories, range, members);
        List<AdminTrendPoint> signupTrend = signupTrend(newMembers, buckets);
        List<AdminTrendPoint> generationTrend = generationTrend(succeededGenerations, buckets);
        List<AdminTrendPoint> downloadTrend = downloadTrend(periodDownloads, buckets);

        return new AdminAnalyticsResponse(
                range.period,
                range.from.toString(),
                range.to.toString(),
                new AdminAnalyticsResponse.Overview(
                        members.size(), newMembers.size(), succeededGenerations.size(), ciGenerations, biGenerations,
                        periodDownloads.size(), ciDownloads, biDownloads),
                new AdminAnalyticsResponse.Signup(
                        members.size(), newMembers.size(), startedMemberIds.size(),
                        providerCounts(newMembers), onboardingUsage, signupTrend,
                        List.of(
                                new AdminMetricPoint("가입 완료", newMembers.size()),
                                new AdminMetricPoint("온보딩 시작", countOnboardings(onboardings, range)),
                                new AdminMetricPoint("온보딩 완료", countOnboardings(onboardings, range)),
                                new AdminMetricPoint("첫 로고 생성 시작", startedMemberIds.size()))),
                new AdminAnalyticsResponse.Generation(
                        succeededGenerations.size(), ciGenerations, biGenerations,
                        succeededGenerations.size(), failedGenerations.size(), surveyStats.likes, surveyStats.dislikes,
                        satisfactionPercent, trademarkUsagePercent, purpose, ciInputs, biInputs, generationTrend),
                new AdminAnalyticsResponse.Downloads(
                        periodDownloads.size(), ciDownloads, biDownloads,
                        styleCounts(periodDownloads, LogoDownload.ProjectType.CI),
                        styleCounts(periodDownloads, LogoDownload.ProjectType.BI), downloadTrend),
                new AdminAnalyticsResponse.Credits(
                        creditStats.used, creditStats.granted, creditStats.generateUsed, creditStats.downloadUsed,
                        creditStats.surveyGranted, creditStats.signupGranted, creditStats.totalBalance),
                new AdminAnalyticsResponse.Survey(
                        surveyStats.responses, surveyStats.likes, surveyStats.dislikes, surveyStats.improvements));
    }

    public List<AdminAccountRow> admins() {
        return adminRepository.findAll().stream()
                .sorted(Comparator.comparing(Admin::getId))
                .map(a -> new AdminAccountRow(a.getId(), a.getLoginId(), a.getName(), a.getCreatedAt(), a.getLastLoginAt()))
                .toList();
    }

    public List<AdminSurveyResponseRow> surveyResponses() {
        return surveyRepository.findAll().stream()
                .sorted(Comparator.comparing(MemberSurvey::getCompletedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(survey -> {
                    Member member = survey.getMember();
                    return new AdminSurveyResponseRow(
                            survey.getMemberId(), member == null ? null : member.getEmail(),
                            member == null ? null : member.getName(), survey.getRating(),
                            parseImprovements(survey.getImprovementsJson()), survey.getComment(), survey.getCompletedAt());
                })
                .toList();
    }

    public List<AdminLogoMemberRow> logoRecords(LogoDownload.ProjectType type) {
        Map<Long, LogoMemberAccumulator> rows = memberRepository.findAll().stream()
                .sorted(Comparator.comparing(Member::getId))
                .collect(Collectors.toMap(Member::getId, member -> new LogoMemberAccumulator(member),
                        (left, ignored) -> left, LinkedHashMap::new));

        for (LogoCandidate candidate : candidateRepository.findAll()) {
            LogoGeneration generation = candidate.getGeneration();
            if (generation == null || generation.getStatus() != LogoGeneration.Status.SUCCEEDED) continue;
            ProjectLike project = generation.getProject();
            if (project == null) continue;
            LogoDownload.ProjectType projectType = project instanceof CiProject
                    ? LogoDownload.ProjectType.CI : LogoDownload.ProjectType.BI;
            if (projectType != type || project.getMember() == null) continue;
            LogoMemberAccumulator row = rows.computeIfAbsent(project.getMember().getId(),
                    ignored -> new LogoMemberAccumulator(project.getMember()));
            row.generated.add(asset(candidate, project, candidate.getCreatedAt()));
        }

        for (LogoDownload download : downloadRepository.findAll()) {
            if (download.getProjectType() != type || download.getMember() == null || download.getCandidate() == null) continue;
            LogoCandidate candidate = download.getCandidate();
            LogoGeneration generation = candidate.getGeneration();
            if (generation == null || generation.getStatus() != LogoGeneration.Status.SUCCEEDED) continue;
            ProjectLike project = generation.getProject();
            if (project == null) continue;
            LogoMemberAccumulator row = rows.computeIfAbsent(download.getMember().getId(),
                    ignored -> new LogoMemberAccumulator(download.getMember()));
            row.downloaded.add(asset(candidate, project, download.getDownloadedAt()));
        }

        return rows.values().stream().map(LogoMemberAccumulator::toRow).toList();
    }

    public byte[] readCandidateImage(String candidatePublicId) {
        LogoCandidate candidate = candidateRepository.findByPublicId(candidatePublicId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        return fileStorage.read(candidate.getStorageKey());
    }

    private AdminLogoAsset asset(LogoCandidate candidate, ProjectLike project, LocalDateTime date) {
        String projectName = project instanceof CiProject ci ? ci.getCompanyName() : ((BiProject) project).getBrandName();
        if (projectName == null || projectName.isBlank()) projectName = "이름 없는 프로젝트";
        return new AdminLogoAsset(
                candidate.getPublicId(), project.getPublicId(),
                "/api/v1/admin/candidates/" + candidate.getPublicId() + "/image",
                projectName, date == null ? "" : DATE_FORMAT.format(date));
    }

    private long countType(List<LogoGeneration> generations, LogoDownload.ProjectType type) {
        return generations.stream().filter(g -> typeOf(g) == type).count();
    }

    private LogoDownload.ProjectType typeOf(LogoGeneration generation) {
        return generation.getCiProject() != null ? LogoDownload.ProjectType.CI : LogoDownload.ProjectType.BI;
    }

    private Long memberIdOf(LogoGeneration generation) {
        ProjectLike project = generation.getProject();
        return project == null || project.getMember() == null ? null : project.getMember().getId();
    }

    private List<AdminMetricPoint> providerCounts(List<Member> members) {
        Map<String, Long> counts = members.stream().collect(Collectors.groupingBy(
                member -> normalizeProvider(member.getProvider()), TreeMap::new, Collectors.counting()));
        return counts.entrySet().stream().map(entry -> new AdminMetricPoint(entry.getKey(), entry.getValue())).toList();
    }

    private String normalizeProvider(String provider) {
        if (provider == null || provider.isBlank()) return "기타";
        return switch (provider.toLowerCase(Locale.ROOT)) {
            case "kakao" -> "카카오 로그인";
            case "google" -> "Google 로그인";
            default -> "기타";
        };
    }

    private long countOnboardings(List<MemberOnboarding> onboardings, Range range) {
        return onboardings.stream().filter(o -> inRange(o.getCompletedAt(), range)).count();
    }

    private List<AdminMetricPoint> onboardingUsage(List<MemberOnboarding> onboardings, Range range) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (MemberOnboarding onboarding : onboardings) {
            if (!inRange(onboarding.getCompletedAt(), range)) continue;
            for (String usage : java.util.stream.Stream.of(onboarding.getUsage1(), onboarding.getUsage2(), onboarding.getUsage3()).toList()) {
                if (usage == null || usage.isBlank()) continue;
                String label = switch (usage.toLowerCase(Locale.ROOT)) {
                    case "online" -> "온라인 판매";
                    case "social" -> "SNS";
                    case "offline" -> "오프라인";
                    default -> usage;
                };
                counts.merge(label, 1L, Long::sum);
            }
        }
        return counts.entrySet().stream().map(entry -> new AdminMetricPoint(entry.getKey(), entry.getValue())).toList();
    }

    private List<AdminMetricPoint> topInputs(List<String> values) {
        Map<String, Long> counts = new HashMap<>();
        values.stream()
                .filter(Objects::nonNull)
                .flatMap(value -> java.util.Arrays.stream(value.split("[,，/|]")))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .forEach(value -> counts.merge(value, 1L, Long::sum));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(4)
                .map(entry -> new AdminMetricPoint(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<AdminMetricPoint> styleCounts(List<LogoDownload> downloads, LogoDownload.ProjectType type) {
        Map<String, Long> counts = new HashMap<>();
        downloads.stream()
                .filter(download -> download.getProjectType() == type)
                .map(download -> download.getCandidate() == null || download.getCandidate().getGeneration() == null
                        ? null : download.getCandidate().getGeneration().getProject())
                .filter(Objects::nonNull)
                .map(ProjectLike::getLogoStyle)
                .filter(Objects::nonNull)
                .map(this::styleLabel)
                .forEach(style -> counts.merge(style, 1L, Long::sum));
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> new AdminMetricPoint(entry.getKey(), percentage(entry.getValue(), total)))
                .toList();
    }

    private String styleLabel(String style) {
        return switch (style.toLowerCase(Locale.ROOT)) {
            case "combination", "콤비네이션" -> "콤비네이션";
            case "symbol", "symbolmark", "심볼마크" -> "심볼마크";
            case "wordmark", "워드마크" -> "워드마크";
            case "lettermark", "레터마크" -> "레터마크";
            default -> style;
        };
    }

    private SurveyStats surveyStats(List<MemberSurvey> surveys, Range range) {
        long responses = 0;
        long likes = 0;
        long dislikes = 0;
        Map<String, Long> improvements = new LinkedHashMap<>();
        DEFAULT_SURVEY_CATEGORIES.forEach(category -> improvements.put(category, 0L));
        for (MemberSurvey survey : surveys) {
            if (!inRange(survey.getCompletedAt(), range)) continue;
            responses++;
            if (survey.getRating() != null && survey.getRating() == 5) likes++;
            if (survey.getRating() != null && survey.getRating() == 1) dislikes++;
            for (String improvement : parseImprovements(survey.getImprovementsJson())) {
                improvements.merge(improvement, 1L, Long::sum);
            }
        }
        return new SurveyStats(responses, likes, dislikes,
                improvements.entrySet().stream().map(entry -> new AdminMetricPoint(entry.getKey(), entry.getValue())).toList());
    }

    private List<String> parseImprovements(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> parsed = objectMapper.readValue(json, new TypeReference<List<String>>() {});
            return parsed == null ? List.of() : parsed;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private CreditStats creditStats(List<CreditHistory> histories, Range range, List<Member> members) {
        long used = 0;
        long granted = 0;
        long generateUsed = 0;
        long downloadUsed = 0;
        long surveyGranted = 0;
        long signupGranted = 0;
        for (CreditHistory history : histories) {
            if (!inRange(history.getCreatedAt(), range)) continue;
            if (history.getAmount() < 0) {
                used += Math.abs((long) history.getAmount());
                if (history.getReason() == CreditHistory.Reason.GENERATE) generateUsed += Math.abs((long) history.getAmount());
                if (history.getReason() == CreditHistory.Reason.DOWNLOAD) downloadUsed += Math.abs((long) history.getAmount());
            } else {
                granted += history.getAmount();
                if (history.getReason() == CreditHistory.Reason.SURVEY) surveyGranted += history.getAmount();
                if (history.getReason() == CreditHistory.Reason.SIGNUP) signupGranted += history.getAmount();
            }
        }
        long totalBalance = members.stream().mapToLong(Member::getCreditBalance).sum();
        return new CreditStats(used, granted, generateUsed, downloadUsed, surveyGranted, signupGranted, totalBalance);
    }

    private List<AdminTrendPoint> signupTrend(List<Member> members, List<Bucket> buckets) {
        long[] values = new long[buckets.size()];
        members.forEach(member -> increment(values, bucketIndex(member.getCreatedAt(), buckets)));
        return buckets.stream().map((bucket) -> {
            int index = buckets.indexOf(bucket);
            return new AdminTrendPoint(bucket.label, values[index], 0, 0);
        }).toList();
    }

    private List<AdminTrendPoint> generationTrend(List<LogoGeneration> generations, List<Bucket> buckets) {
        long[] ci = new long[buckets.size()];
        long[] bi = new long[buckets.size()];
        generations.forEach(generation -> {
            int index = bucketIndex(generation.getCreatedAt(), buckets);
            if (index < 0) return;
            if (typeOf(generation) == LogoDownload.ProjectType.CI) ci[index]++;
            else bi[index]++;
        });
        return buckets.stream().map(bucket -> {
            int index = buckets.indexOf(bucket);
            return new AdminTrendPoint(bucket.label, ci[index] + bi[index], ci[index], bi[index]);
        }).toList();
    }

    private List<AdminTrendPoint> downloadTrend(List<LogoDownload> downloads, List<Bucket> buckets) {
        long[] ci = new long[buckets.size()];
        long[] bi = new long[buckets.size()];
        downloads.forEach(download -> {
            int index = bucketIndex(download.getDownloadedAt(), buckets);
            if (index < 0) return;
            if (download.getProjectType() == LogoDownload.ProjectType.CI) ci[index]++;
            else bi[index]++;
        });
        return buckets.stream().map(bucket -> {
            int index = buckets.indexOf(bucket);
            return new AdminTrendPoint(bucket.label, ci[index] + bi[index], ci[index], bi[index]);
        }).toList();
    }

    private void increment(long[] values, int index) {
        if (index >= 0 && index < values.length) values[index]++;
    }

    private int bucketIndex(LocalDateTime value, List<Bucket> buckets) {
        if (value == null) return -1;
        for (int index = 0; index < buckets.size(); index++) {
            Bucket bucket = buckets.get(index);
            if (!value.isBefore(bucket.from) && value.isBefore(bucket.to)) return index;
        }
        return -1;
    }

    private boolean inRange(LocalDateTime value, Range range) {
        return value != null && !value.isBefore(range.from) && value.isBefore(range.to);
    }

    private int percentage(long value, long total) {
        return total == 0 ? 0 : (int) Math.round(value * 100.0 / total);
    }

    private List<Bucket> buckets(Range range) {
        List<Bucket> result = new ArrayList<>();
        if ("daily".equals(range.period)) {
            for (int index = 0; index < 12; index++) {
                LocalDateTime from = range.from.plusHours(index * 2L);
                result.add(new Bucket(from, from.plusHours(2), String.format("%02d시", index * 2)));
            }
            return result;
        }
        if ("monthly".equals(range.period)) {
            LocalDateTime cursor = range.from.withDayOfMonth(1);
            while (cursor.isBefore(range.to)) {
                LocalDateTime next = cursor.plusMonths(1);
                result.add(new Bucket(cursor, next, cursor.getMonthValue() + "월"));
                cursor = next;
            }
            return result;
        }
        if ("custom".equals(range.period)) {
            long seconds = Math.max(1, Duration.between(range.from, range.to).getSeconds());
            for (int index = 0; index < 12; index++) {
                LocalDateTime from = range.from.plusSeconds(seconds * index / 12);
                LocalDateTime to = index == 11 ? range.to : range.from.plusSeconds(seconds * (index + 1) / 12);
                result.add(new Bucket(from, to, String.valueOf(index + 1)));
            }
            return result;
        }
        for (int index = 0; index < 7; index++) {
            LocalDateTime from = range.from.plusDays(index);
            result.add(new Bucket(from, from.plusDays(1), from.getMonthValue() + "/" + from.getDayOfMonth()));
        }
        return result;
    }

    private record Range(String period, LocalDateTime from, LocalDateTime to) {
        private static Range resolve(String requestedPeriod, LocalDate customFrom, LocalDate customTo) {
            String period = requestedPeriod == null ? "weekly" : requestedPeriod.toLowerCase(Locale.ROOT);
            if (!VALID_PERIODS.contains(period)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "period는 daily, weekly, monthly, custom 중 하나여야 합니다.");
            LocalDate today = LocalDate.now(ZoneId.systemDefault());
            if ("custom".equals(period)) {
                if (customFrom == null || customTo == null || customTo.isBefore(customFrom)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "사용자 지정 기간은 from과 to를 올바르게 입력해주세요.");
                }
                return new Range(period, customFrom.atStartOfDay(), customTo.plusDays(1).atStartOfDay());
            }
            if ("daily".equals(period)) return new Range(period, today.atStartOfDay(), today.plusDays(1).atStartOfDay());
            if ("monthly".equals(period)) {
                LocalDate start = today.withDayOfMonth(1).minusMonths(11);
                return new Range(period, start.atStartOfDay(), today.withDayOfMonth(1).plusMonths(1).atStartOfDay());
            }
            LocalDate start = today.minusDays(6);
            return new Range(period, start.atStartOfDay(), today.plusDays(1).atStartOfDay());
        }
    }

    private record Bucket(LocalDateTime from, LocalDateTime to, String label) {}

    private record SurveyStats(long responses, long likes, long dislikes, List<AdminMetricPoint> improvements) {}

    private record CreditStats(long used, long granted, long generateUsed, long downloadUsed,
                               long surveyGranted, long signupGranted, long totalBalance) {}

    private static final class LogoMemberAccumulator {
        private final String memberId;
        private final String memberName;
        private final List<AdminLogoAsset> generated = new ArrayList<>();
        private final List<AdminLogoAsset> downloaded = new ArrayList<>();

        private LogoMemberAccumulator(Member member) {
            this.memberId = member.getEmail();
            this.memberName = member.getName();
        }

        private AdminLogoMemberRow toRow() {
            generated.sort(Comparator.comparing(AdminLogoAsset::date).reversed());
            downloaded.sort(Comparator.comparing(AdminLogoAsset::date).reversed());
            return new AdminLogoMemberRow(memberId, memberName, List.copyOf(generated), List.copyOf(downloaded));
        }
    }
}
