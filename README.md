# 💸 함께 쓰는 가계부 (Money Ledger)

개인 생활비, 가족 공유 가계부, 모임 회비 관리부터 **1인 기업 및 소규모 법인을 위한 회사 가계부(세금계산서·부가세·종합소득세 예측)**까지 하나로 통합 관리할 수 있는 오픈소스 웹 가계부 플랫폼입니다.

---

## ✨ 핵심 기능

### 1. 개인 및 가족 가계부
- **스프레드시트형 거래 장부**: 키보드 단축키, 대량 복사/붙여넣기, 빠른 거래 등록 및 인라인 수정.
- **월별 고정비 & 예산 관리**: 구독료, 보험료, 공과금 등 정기 결제 자동 스케줄링 및 예산 소진율 트래킹.
- **통합 자산 관리**: 계좌, 카드, 예적금, 투자(주식), 부채, 부동산을 아우르는 종합 순자산 대시보드.
- **시각화 분석 & 달력**: 카테고리별 지출 비중, 수입·지출 흐름, 일자별 소비 캘린더.

### 2. 모임 & 동호회 회비 관리
- **회비 납부 현황표**: 월별 회비 납부자 명단 관리, 미납/완납/선납/분할 납부 자동 판별.
- **영수증 및 증빙 첨부**: 거래별 이미지(JPG, PNG, WebP) 및 PDF 영수증 보관 (최대 5개, 파일당 5MB).
- **워크스페이스 권한 분리**: 소유자(Owner), 관리자(Admin), 편집자(Editor), 뷰어(Viewer) 역할 체계.

### 3. 회사 가계부 & 세무 예측
- **세금계산서 발행 및 입금 추적**: 공급가액, 부가세(10%), 합계금액, 입금예정일 대비 실제 입금일 및 입금완료/대기/지연 상태 관리.
- **부가가치세 & 종합소득세 실시간 계산**: 누적 매출 및 지출 데이터를 바탕으로 예상 세액 자동 산출.
- **과거 실적 기반 지능형 세금 예측**: 기납부 실적 데이터를 분석하여 다가오는 분기별 부가세(예정고지/확정신고) 및 종합소득세(5월 확정/11월 중간예납) 예측.
- **회사 가계부 전용 고유 링크**: `/?tab=company` 바로가기 지원.

### 4. 엔터프라이즈급 보안 & 프라이버시
- **생체인증 패스키(WebAuthn)**: Touch ID / Face ID 하드웨어 보안키 지원.
- **화면 잠금 & 프라이버시 모드**: 공유 화면이나 공공장소에서 금액 마스킹(`••••••`).
- **호스트 전용 보안 세션**: HttpOnly, Secure, SameSite 쿠키 기반 JWT 세션 및 속도 제한(Rate Limiting).

---

## 🛠️ 기술 스택

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database & ORM**: PostgreSQL, Prisma 7.x
- **Authentication**: Custom Session JWT, WebAuthn Passkeys, Kakao OAuth (선택)
- **Styling**: Modern CSS Modules & Glassmorphism Design System

---

## 🚀 빠른 시작 (Getting Started)

### 1. 필수 요구사항
- Node.js 20 LTS 이상
- PostgreSQL 14 이상

### 2. 저장소 복제 및 의존성 설치
```bash
git clone https://github.com/your-username/money-ledger.git
cd money-ledger
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env`를 생성하고 필요한 설정을 입력합니다.

```bash
cp .env.example .env
```

주요 설정 항목:
```env
PORT=4010
DATABASE_URL="postgresql://user:password@localhost:5432/money_db?schema=public"
JWT_SECRET="your-secure-random-jwt-secret-at-least-32-chars"
WEBAUTHN_ORIGIN="http://localhost:4010"
WEBAUTHN_RP_ID="localhost"
```

### 4. 데이터베이스 초기화
```bash
# Prisma 클라이언트 생성
npx prisma generate

# 추가 테이블(모임 회비 및 영수증) 적용
npx prisma db execute --file prisma/sql/club-ledger.sql

# (선택사항) 회사 가계부 샘플 데이터 적재
npx tsx scripts/seed-sample-company.ts
```

### 5. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:4010` (또는 지정한 포트)으로 접속합니다.

---

## 🧪 테스트 및 빌드 검증

```bash
# 전체 단위 및 통합 테스트 실행
npm test

# 프로덕션 빌드 검증
npm run build
```

---

## 🚢 서버 배포 가이드

### 1. Nginx 리버스 프록시 설정
`nginx/money-ledger.conf.example`을 참조하여 Nginx 설정을 적용합니다. 영수증 업로드를 위해 `client_max_body_size 6m;` 설정이 권장됩니다.

```bash
sudo cp nginx/money-ledger.conf.example /etc/nginx/sites-available/money-ledger
sudo ln -s /etc/nginx/sites-available/money-ledger /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2. PM2 무중단 운영
```bash
# PM2로 애플리케이션 시작
pm2 start npm --name "money-ledger" -- run start

# 프로세스 상태 저장
pm2 save
```

제공된 `deploy.sh` 스크립트를 환경변수와 함께 실행하여 원격 서버로 간편하게 자동 배포할 수도 있습니다.
```bash
DEPLOY_USER="deploy" DEPLOY_HOST="your-server-ip" ./deploy.sh
```

---

## 📄 라이선스 (License)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
