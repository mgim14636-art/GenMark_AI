# GenMark-AI (AI-powered Trademark & Logo Generation Platform)

GenMark-AI는 Generative AI(FLUX) 및 Visual Similarity(DINOv2 + FAISS)를 활용한 상표 및 로고 생성·유사도 검증 플랫폼입니다.

---

## 🏗️ Architecture Overview

- **Backend**: Java 17 / Spring Boot 3.x (Thymeleaf, Spring Data JPA, Security)
- **AI Server**: Python 3.10+ / FastAPI (FLUX, DINOv2, FAISS, PyTorch)
- **Database**: MariaDB 10.11
- **Reverse Proxy**: Nginx
- **Containerization**: Docker, Docker Compose

---

## 🚀 Quick Start with Docker Compose

### 1. 환경 변수 설정
```bash
cp .env.example .env
```

### 2. 로컬 개발 환경 실행 (Docker Compose)
```bash
# 컨테이너 빌드 및 백그라운드 실행
docker compose up -d --build

# 실행 상태 확인
docker compose ps

# 전체 로그 확인
docker compose logs -f
```

### 3. 접속 URL
- **Nginx Web Gateway**: http://localhost
- **Spring Boot Backend Direct**: http://localhost:8080
- **FastAPI AI Server Swagger UI**: http://localhost:8000/docs
- **MariaDB Database**: `localhost:3306` (User: `genmark_user` / Pass: `genmark_pass`)

---

## 🧰 Portable Codex Setup

이 프로젝트는 전역 Codex 지침과 사용자 관리 스킬을 Git으로 재현할 수 있도록 portable 패키지를 제공합니다.

다른 환경에서 저장소를 받은 뒤 한 번 실행하세요:

```powershell
pwsh -NoProfile -File .\scripts\setup-codex.ps1
```

스킬까지 Git 버전으로 업데이트하려면 `-Force`를 사용합니다. 자세한 범위, 백업, 전역 설정 교체 방법은 [`docs/codex-portable.md`](docs/codex-portable.md)를 참고하세요.

---

## 📁 Project Structure

```text
GenMark-AI/
├── backend/                # Spring Boot 백엔드 (Java 17)
├── ai-server/              # FastAPI AI 서비스 (Python)
├── database/               # MariaDB DDL, DML 스크립트
├── infra/                  # Nginx 및 배포 설정
├── docs/                   # 프로젝트 관련 문서
├── docker-compose.yml      # 로컬 / 개발 Docker Compose
└── README.md
```
