# 바코드 스캔 및 메일 발송 웹 애플리케이션

모바일에서 바코드를 스캔하고, 추출된 바코드 번호와 사진을 이메일로 발송하는 웹 애플리케이션입니다.

## 주요 기능

- 📱 모바일 최적화 (반응형 디자인)
- 📷 바코드 사진 촬영 및 인식 (최대 30개)
- 🔍 실시간 바코드 스캔 (Google Cloud Vision API 사용)
- 📧 바코드 정보 이메일 발송
- 🔲 QR 코드 생성 (모든 바코드 번호 포함)
- 👤 사번 및 이름 입력
- 📬 메일 주소 입력

## 기술 스택

- **프론트엔드**: React + Vite
- **바코드 인식**: Google Cloud Vision API
- **QR 코드 생성**: qrcode
- **백엔드**: Vercel API Routes
- **이메일 발송**: nodemailer

## 설치 및 실행

### 로컬 개발

1. 패키지 설치:
```bash
npm install
```

2. 개발 서버 실행:
```bash
npm run dev
```

3. 브라우저에서 `http://localhost:3000` 접속

### 빌드

```bash
npm run build
```

## Vercel 배포

### 1. Vercel에 프로젝트 배포

```bash
npm i -g vercel
vercel
```

또는 Vercel 웹사이트에서 GitHub 저장소를 연결하여 배포할 수 있습니다.

### 2. 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정해야 합니다:

#### 이메일 발송 설정
- `SMTP_HOST`: SMTP 서버 주소 (예: smtp.gmail.com)
- `SMTP_PORT`: SMTP 포트 (예: 587)
- `SMTP_SECURE`: 보안 연결 여부 (true/false)
- `SMTP_USER`: SMTP 사용자명 (이메일 주소)
- `SMTP_PASS`: SMTP 비밀번호 또는 앱 비밀번호

#### Google Cloud Vision API 설정
- `GOOGLE_CLOUD_VISION_API_KEY`: Google Cloud Vision API 키

**Google Cloud Vision API 키 발급 및 설정 방법:**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 선택
3. **결제 계정 연결 (필수)**
   - [결제 설정 페이지](https://console.cloud.google.com/billing)로 이동
   - 결제 계정을 생성하거나 기존 계정에 연결
   - ⚠️ **중요**: Google Cloud Vision API는 결제가 활성화되어 있어야 사용 가능합니다
   - 무료 할당량이 제공되지만 결제 정보 등록이 필요합니다
4. "API 및 서비스" > "라이브러리"로 이동
5. "Cloud Vision API" 검색 후 활성화
6. "API 및 서비스" > "사용자 인증 정보"로 이동
7. "사용자 인증 정보 만들기" > "API 키" 선택
8. 생성된 API 키를 복사하여 환경 변수에 설정

**결제 활성화 오류 해결:**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (API 키가 속한 프로젝트)
3. [결제 설정 페이지](https://console.cloud.google.com/billing)로 이동
4. 프로젝트에 결제 계정이 연결되어 있는지 확인
5. [API 및 서비스 > 라이브러리](https://console.cloud.google.com/apis/library)에서 "Cloud Vision API" 검색
6. Cloud Vision API가 활성화되어 있는지 확인 (활성화 버튼이 있으면 클릭)
7. 결제 계정 연결 후 **5-10분 정도 기다린 후** 다시 시도
8. 여전히 오류가 발생하면:
   - API 키가 올바른 프로젝트에 속해 있는지 확인
   - 프로젝트 번호 확인: 오류 메시지에 표시된 프로젝트 번호와 일치하는지 확인

#### Gmail 사용 예시

Gmail을 사용하는 경우:

1. Google 계정 설정에서 2단계 인증 활성화
2. 앱 비밀번호 생성: [Google 계정 관리](https://myaccount.google.com/apppasswords)
3. 환경 변수 설정:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_SECURE`: `false`
   - `SMTP_USER`: `your-email@gmail.com`
   - `SMTP_PASS`: 생성한 앱 비밀번호

#### 다른 이메일 서비스

다른 이메일 서비스(SendGrid, Mailgun 등)를 사용하는 경우, 해당 서비스의 SMTP 설정을 참고하여 환경 변수를 설정하세요.

## 사용 방법

1. **사번 입력**: 7자리 숫자 입력
2. **이름 입력**: 이름 입력
3. **메일 주소 입력**: 발송받을 이메일 주소 입력
4. **바코드 스캔**:
   - 모바일: "카메라로 촬영" 버튼 클릭
   - 데스크톱: "사진 선택" 또는 "실시간 스캔 시작" 버튼 사용
5. **QR 코드 확인**: 모든 바코드 번호가 포함된 QR 코드 자동 생성
6. **메일 발송**: "메일 발송" 버튼 클릭

## 바코드 형식

- 바코드 번호는 22자리 (숫자 + 영문 조합)
- 지원 형식: Code128, Code39 등

## 제한사항

- 최대 30개의 바코드 업로드 가능
- 모바일에서는 갤러리 업로드 불가 (카메라 촬영만 가능)

## 라이선스

MIT

