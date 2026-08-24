package com.genmark.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.genmark.ai.entity.CreditHistory;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberSurvey;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.web.dto.survey.SurveySubmitRequest;
import jakarta.persistence.Column;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SurveyServiceTest {

    @Test
    void surveyNumericColumnsMatchMigrationTypes() throws NoSuchFieldException {
        Column rating = MemberSurvey.class.getDeclaredField("rating").getAnnotation(Column.class);
        Column surveyVersion = MemberSurvey.class.getDeclaredField("surveyVersion").getAnnotation(Column.class);

        assertThat(rating.columnDefinition()).isEqualTo("TINYINT");
        assertThat(surveyVersion.columnDefinition()).isEqualTo("SMALLINT");
    }

    @Test
    void surveyRewardMatchesTheOneCreditPromisedByTheUi() {
        assertThat(CreditService.SURVEY_GRANT).isEqualTo(1);
    }

    @Test
    void storesSubmittedAnswersAndNormalizesBlankComment() {
        MemberSurveyRepository surveyRepository = mock(MemberSurveyRepository.class);
        MemberRepository memberRepository = mock(MemberRepository.class);
        CreditService creditService = mock(CreditService.class);
        Member member = Member.builder().id(7L).build();
        when(memberRepository.findById(7L)).thenReturn(Optional.of(member));
        when(creditService.grant(7L, CreditService.SURVEY_GRANT, CreditHistory.Reason.SURVEY))
                .thenReturn(5);

        SurveyService service = new SurveyService(
                surveyRepository, memberRepository, creditService, new ObjectMapper());
        service.submit(7L, new SurveySubmitRequest(
                5, List.of("로고 수정이 어렵거나 마음대로 안 됨", "유사 상표 확인 결과를 얼마나 믿어야 할지 모르겠음"), "   "));

        ArgumentCaptor<MemberSurvey> captor = ArgumentCaptor.forClass(MemberSurvey.class);
        verify(surveyRepository).save(captor.capture());
        assertThat(captor.getValue().getRating()).isEqualTo(5);
        assertThat(captor.getValue().getImprovementsJson())
                .isEqualTo("[\"로고 수정이 어렵거나 마음대로 안 됨\",\"유사 상표 확인 결과를 얼마나 믿어야 할지 모르겠음\"]");
        assertThat(captor.getValue().getComment()).isNull();
        assertThat(captor.getValue().getSurveyVersion()).isEqualTo(1);
    }

    @Test
    void keepsLegacyBodylessSubmissionCompatible() {
        MemberSurveyRepository surveyRepository = mock(MemberSurveyRepository.class);
        MemberRepository memberRepository = mock(MemberRepository.class);
        CreditService creditService = mock(CreditService.class);
        Member member = Member.builder().id(8L).build();
        when(memberRepository.findById(8L)).thenReturn(Optional.of(member));
        when(creditService.grant(8L, CreditService.SURVEY_GRANT, CreditHistory.Reason.SURVEY))
                .thenReturn(3);

        SurveyService service = new SurveyService(
                surveyRepository, memberRepository, creditService, new ObjectMapper());
        service.submit(8L, null);

        ArgumentCaptor<MemberSurvey> captor = ArgumentCaptor.forClass(MemberSurvey.class);
        verify(surveyRepository).save(captor.capture());
        assertThat(captor.getValue().getRating()).isNull();
        assertThat(captor.getValue().getImprovementsJson()).isNull();
        assertThat(captor.getValue().getComment()).isNull();
    }
}
