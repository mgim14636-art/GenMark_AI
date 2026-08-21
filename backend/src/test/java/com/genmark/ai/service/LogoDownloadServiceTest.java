package com.genmark.ai.service;

import com.genmark.ai.entity.LogoDownload;
import com.genmark.ai.entity.Member;
import com.genmark.ai.repository.LogoCandidateRepository;
import com.genmark.ai.repository.LogoDownloadRepository;
import com.genmark.ai.repository.MemberRepository;
import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class LogoDownloadServiceTest {

    @Test
    void deletesOwnedDownloadAndArchivedFile() {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoDownload download = LogoDownload.builder()
                .id(42L)
                .member(Member.builder().id(7L).build())
                .storageKey("downloads/7/candidate-1.png")
                .build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class), storage,
                new com.fasterxml.jackson.databind.ObjectMapper(), 20);

        service.delete(42L, 7L);

        verify(storage).deleteQuietly("downloads/7/candidate-1.png");
        verify(downloads).delete(download);
    }

    @Test
    void refusesDownloadOwnedByAnotherMember() {
        LogoDownloadRepository downloads = mock(LogoDownloadRepository.class);
        LogoDownload download = LogoDownload.builder()
                .id(42L)
                .member(Member.builder().id(7L).build())
                .storageKey("downloads/7/candidate-1.png")
                .build();
        when(downloads.findById(42L)).thenReturn(Optional.of(download));
        LogoFileStorage storage = mock(LogoFileStorage.class);
        LogoDownloadService service = new LogoDownloadService(mock(ProjectLookupService.class),
                mock(LogoCandidateRepository.class), downloads, mock(MemberRepository.class), storage,
                new com.fasterxml.jackson.databind.ObjectMapper(), 20);

        assertThatThrownBy(() -> service.delete(42L, 9L))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode())
                                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(storage);
        verify(downloads, never()).delete(any());
    }
}
