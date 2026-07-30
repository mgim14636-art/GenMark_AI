// ============================================
// GenMark AI — Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Navbar Scroll Effect ----------
  const nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  // ---------- Hamburger Menu ----------
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // ---------- Scroll Reveal ----------
  const revealEls = document.querySelectorAll(
    '.feature-card, .step, .showcase-item, .stat-card, .project-card'
  );
  revealEls.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => observer.observe(el));

  // ---------- Smooth Anchor Scroll ----------
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---------- Active Nav Link ----------
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 120;
    sections.forEach(sec => {
      const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
      if (!link) return;
      if (sec.offsetTop <= scrollY && sec.offsetTop + sec.offsetHeight > scrollY) {
        document.querySelectorAll('.nav-links a').forEach(l => l.style.color = '');
        link.style.color = 'var(--primary)';
      }
    });
  }, { passive: true });

  // ---------- Toast System ----------
  window.showToast = (message, type = 'info', duration = 3500) => {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ---------- Loading Overlay ----------
  window.showLoading = (text = '처리 중...') => {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-ring"></div><div class="loading-text">${text}</div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = text;
    overlay.classList.add('active');
  };
  window.hideLoading = () => {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.classList.remove('active');
  };

  // ---------- Style Chips (Generate Page) ----------
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const ta = document.getElementById('prompt-input');
      if (!ta) return;
      const tag = chip.dataset.tag || chip.textContent;
      if (chip.classList.contains('active')) {
        ta.value += (ta.value ? ', ' : '') + tag;
      }
    });
  });

  // ---------- Color Swatches ----------
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  // ---------- Generate Form ----------
  const generateBtn = document.getElementById('generate-btn');
  const promptInput = document.getElementById('prompt-input');
  if (generateBtn && promptInput) {
    generateBtn.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) {
        showToast('프롬프트를 입력해주세요.', 'error');
        return;
      }
      showLoading('AI가 로고를 생성하는 중...');
      generateBtn.disabled = true;

      // Simulate API call
      setTimeout(() => {
        hideLoading();
        generateBtn.disabled = false;
        const placeholder = document.getElementById('result-placeholder');
        const resultImg = document.getElementById('result-image');
        const resultActions = document.getElementById('result-actions');
        const similarityPanel = document.getElementById('similarity-panel');

        if (placeholder) placeholder.style.display = 'none';
        if (resultImg) {
          resultImg.style.display = 'block';
          resultImg.style.background = 'linear-gradient(135deg, #1a1040 0%, #2d1b6b 50%, #0d2040 100%)';
          resultImg.style.minHeight = '300px';
        }
        if (resultActions) resultActions.style.display = 'flex';
        if (similarityPanel) similarityPanel.style.display = 'block';

        showToast('로고가 성공적으로 생성되었습니다!', 'success');
      }, 3000);
    });
  }

  // ---------- Download Button ----------
  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      showToast('로고를 다운로드하는 중...', 'info');
      // Real: window.location.href = '/logo/download/' + logoId;
    });
  }

  // ---------- Similarity Check Button ----------
  const checkSimilarityBtn = document.getElementById('check-similarity-btn');
  if (checkSimilarityBtn) {
    checkSimilarityBtn.addEventListener('click', () => {
      showLoading('상표 유사도 검사 중...');
      setTimeout(() => {
        hideLoading();
        showToast('유사도 검사 완료!', 'success');
      }, 2000);
    });
  }

  // ---------- Login Form ----------
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showToast('이메일과 비밀번호를 입력해주세요.', 'error');
        return;
      }
      showLoading('로그인 중...');

      // Simulate login
      setTimeout(() => {
        hideLoading();
        // Real: fetch('/member/login', ...)
        showToast('로그인 성공! 대시보드로 이동합니다.', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
      }, 1200);
    });
  }

  // ---------- Register Form ----------
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('password-confirm').value;

      if (!name || !email || !password) {
        showToast('모든 항목을 입력해주세요.', 'error');
        return;
      }
      if (password !== passwordConfirm) {
        showToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
      }
      showLoading('계정 생성 중...');

      setTimeout(() => {
        hideLoading();
        showToast('회원가입 완료! 로그인 페이지로 이동합니다.', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1200);
      }, 1400);
    });
  }

  // ---------- New Project Button ----------
  const newProjectBtn = document.getElementById('new-project-btn');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      window.location.href = 'generate.html';
    });
  }

  // ---------- Counter Animation ----------
  const counters = document.querySelectorAll('.stat-num');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const rawText = el.textContent;
      const num = parseInt(rawText.replace(/[^0-9]/g, ''));
      if (isNaN(num)) return;
      const suffix = rawText.replace(/[0-9,]/g, '');
      let current = 0;
      const step = Math.ceil(num / 60);
      const timer = setInterval(() => {
        current = Math.min(current + step, num);
        el.textContent = current.toLocaleString() + suffix;
        if (current >= num) clearInterval(timer);
      }, 20);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));

});
