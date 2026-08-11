package com.genmark.ai.service;

import com.genmark.ai.entity.CreditHistory;
import com.genmark.ai.entity.Member;
import com.genmark.ai.entity.MemberSurvey;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MemberSurveyRepository;
import com.genmark.ai.web.dto.survey.SurveyResponse;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 설문조사 응답과 그 보상 크레딧 지급 (F15).
 *
 * <p>회원당 1회만 응답할 수 있다. member_surveys의 기본키가 member_id라서 두 번째 응답은
 * DB가 막지만, 사용자에게 친절한 메시지를 주려고 서비스에서도 먼저 확인한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SurveyService {

    private final MemberSurveyRepository surveyRepository;
    private final MemberRepository memberRepository;
    private final CreditService creditService;

    public SurveyResponse status(Long memberId) {
        boolean completed = surveyRepository.existsByMemberId(memberId);
        return new SurveyResponse(completed, creditService.balanceOf(memberId));
    }

    /**
     * 설문 응답을 기록하고 크레딧 2개를 지급한다.
     *
     * <p>기록과 지급이 한 트랜잭션 안에 있으므로 "응답은 됐는데 크레딧은 안 들어온" 상태가
     * 생기지 않는다.
     */
    @Transactional
    public SurveyResponse submit(Long memberId) {
        if (surveyRepository.existsByMemberId(memberId)) {
            throw new ApiException(ErrorCode.SURVEY_ALREADY_SUBMITTED);
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));

        surveyRepository.save(MemberSurvey.builder()
                .member(member)
                .credited(true)
                .build());

        int balance = creditService.grant(memberId, CreditService.SURVEY_GRANT, CreditHistory.Reason.SURVEY);
        return new SurveyResponse(true, balance);
    }
}
