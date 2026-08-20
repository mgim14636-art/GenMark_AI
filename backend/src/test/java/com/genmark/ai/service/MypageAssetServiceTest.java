package com.genmark.ai.service;

import com.genmark.ai.entity.CiProject;
import com.genmark.ai.entity.LogoCandidate;
import com.genmark.ai.entity.LogoGeneration;
import com.genmark.ai.entity.Member;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.repository.MypageHiddenLogoAssetRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MypageAssetServiceTest {
    @Test
    void hidesOwnedLogoWithoutDeletingCandidate() {
        LogoCandidateRepository candidates = mock(LogoCandidateRepository.class);
        MypageHiddenLogoAssetRepository hiddenAssets = mock(MypageHiddenLogoAssetRepository.class);
        MemberRepository members = mock(MemberRepository.class);
        MypageAssetService service = new MypageAssetService(candidates, hiddenAssets, members);

        CiProject project = CiProject.builder().id(10L).publicId("project-1").build();
        LogoGeneration generation = LogoGeneration.builder()
                .id(20L).publicId("generation-1").ciProject(project)
                .status(LogoGeneration.Status.SUCCEEDED).completedAt(LocalDateTime.now()).build();
        LogoCandidate candidate = LogoCandidate.builder()
                .id(30L).publicId("candidate-1").generation(generation)
                .candidateOrder(1).storageKey("logos/generation-1/candidate-1.png")
                .createdAt(LocalDateTime.now()).build();
        Member member = Member.builder().id(7L).email("member@example.com").name("사용자").build();
        when(candidates.findByPublicIdAndGenerationCiProjectMemberId("candidate-1", 7L))
                .thenReturn(Optional.of(candidate));
        when(candidates.findByPublicIdAndGenerationBiProjectMemberId("candidate-1", 7L))
                .thenReturn(Optional.empty());
        when(hiddenAssets.existsByMemberIdAndCandidateId(7L, 30L)).thenReturn(false);
        when(members.findById(7L)).thenReturn(Optional.of(member));

        service.hideLogo("candidate-1", 7L);

        verify(hiddenAssets).save(any());
        verify(candidates, never()).delete(any());
    }

    @Test
    void doesNotCreateDuplicateHideRecord() {
        LogoCandidateRepository candidates = mock(LogoCandidateRepository.class);
        MypageHiddenLogoAssetRepository hiddenAssets = mock(MypageHiddenLogoAssetRepository.class);
        MemberRepository members = mock(MemberRepository.class);
        MypageAssetService service = new MypageAssetService(candidates, hiddenAssets, members);

        LogoGeneration generation = LogoGeneration.builder()
                .id(20L).publicId("generation-1")
                .status(LogoGeneration.Status.SUCCEEDED).completedAt(LocalDateTime.now()).build();
        LogoCandidate candidate = LogoCandidate.builder()
                .id(30L).publicId("candidate-1").generation(generation)
                .candidateOrder(1).storageKey("logos/generation-1/candidate-1.png")
                .createdAt(LocalDateTime.now()).build();
        when(candidates.findByPublicIdAndGenerationCiProjectMemberId("candidate-1", 7L))
                .thenReturn(Optional.of(candidate));
        when(hiddenAssets.existsByMemberIdAndCandidateId(7L, 30L)).thenReturn(true);

        service.hideLogo("candidate-1", 7L);

        verify(hiddenAssets, never()).save(any());
        verifyNoInteractions(members);
    }
}
