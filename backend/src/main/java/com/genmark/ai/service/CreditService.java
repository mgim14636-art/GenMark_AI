package com.genmark.ai.service;

import com.genmark.ai.entity.CreditHistory;
import com.genmark.ai.entity.Member;
import com.genmark.ai.repository.CreditHistoryRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 크레딧 잔액 증감을 한 곳에서 처리한다.
 *
 * <p>잔액({@link Member#getCreditBalance()})과 이력({@link CreditHistory})은 항상 함께 움직여야
 * 한다. 이 클래스를 거치지 않고 잔액만 고치면 이력 합계와 어긋나므로, 크레딧 변경은 반드시
 * {@link #grant}/{@link #consume}만 사용한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CreditService {

    /** 가입 시 지급량. 설문조사 보상도 같은 값이다. */
    public static final int SIGNUP_GRANT = 2;
    public static final int SURVEY_GRANT = 2;

    private final MemberRepository memberRepository;
    private final CreditHistoryRepository creditHistoryRepository;

    public int balanceOf(Long memberId) {
        return requireMember(memberId).getCreditBalance();
    }

    /** 크레딧 지급. amount는 양수여야 한다. */
    @Transactional
    public int grant(Long memberId, int amount, CreditHistory.Reason reason) {
        if (amount <= 0) throw new ApiException(ErrorCode.VALIDATION_ERROR, "지급 크레딧은 1 이상이어야 합니다.");
        Member member = requireMember(memberId);
        member.setCreditBalance(member.getCreditBalance() + amount);
        record(member, amount, reason);
        return member.getCreditBalance();
    }

    /**
     * 크레딧 차감. 잔액이 모자라면 차감하지 않고 402(PAYMENT_REQUIRED) 성격의 오류를 던진다.
     *
     * <p>차감 시점(로고 생성 시 vs 다운로드 시)은 아직 확정되지 않았다. 어느 쪽으로 정해지든
     * 호출하는 위치만 달라지고 이 메서드는 그대로 쓸 수 있다.
     */
    @Transactional
    public int consume(Long memberId, int amount, CreditHistory.Reason reason) {
        if (amount <= 0) throw new ApiException(ErrorCode.VALIDATION_ERROR, "차감 크레딧은 1 이상이어야 합니다.");
        Member member = requireMember(memberId);
        if (member.getCreditBalance() < amount) {
            throw new ApiException(ErrorCode.CREDIT_NOT_ENOUGH);
        }
        member.setCreditBalance(member.getCreditBalance() - amount);
        record(member, -amount, reason);
        return member.getCreditBalance();
    }

    private void record(Member member, int signedAmount, CreditHistory.Reason reason) {
        creditHistoryRepository.save(CreditHistory.builder()
                .member(member)
                .amount(signedAmount)
                .reason(reason)
                .balanceAfter(member.getCreditBalance())
                .build());
    }

    private Member requireMember(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_REQUIRED));
    }
}
