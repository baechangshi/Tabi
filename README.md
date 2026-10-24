# TAB Studio

기타·베이스 TAB 악보를 웹에서 작성하고, Google 로그인으로 저장·공유하는 사이트입니다.
GitHub `main` 브랜치에 push하면 Firebase Hosting으로 자동 배포됩니다.

- **목록 페이지** (`index.html`): 전체 공개 악보 목록, 검색(제목·아티스트·작성자), 악기 필터, 정렬, 내 악보만 보기
- **편집기** (`editor.html`): 기타 6줄 / 베이스 4줄·5줄, A4 레이아웃, 코드·메모·가사, 드래그 복사·붙여넣기, 재생, MD/PDF 저장
- **권한**: 누구나 열람 가능 · 로그인한 사람만 저장 · 본인 악보만 수정/삭제 · 남의 악보를 저장하면 내 악보로 복사

---

## 폴더 구조

```
tab-studio/
├─ public/                     ← 배포되는 웹사이트
│  ├─ index.html               악보 목록
│  ├─ editor.html              편집기
│  └─ js/
│     ├─ firebase-config.js    ★ Firebase 설정값 (직접 입력)
│     ├─ firebase.js           로그인·저장·목록 공통 코드
│     └─ editor-cloud.js       편집기 ↔ Firebase 연결
├─ firestore.rules             데이터 접근 권한 규칙
├─ firestore.indexes.json      목록 정렬/필터용 색인
├─ firebase.json               Firebase 배포 설정
├─ .firebaserc                 ★ 프로젝트 ID (직접 입력)
└─ .github/workflows/deploy.yml  GitHub → Firebase 자동 배포
```

★ 표시된 두 파일만 수정하면 됩니다.

---

## 설정 방법 (처음 한 번)

> 회사 Google Workspace 계정은 조직 정책 때문에 **서비스 계정 키 만들기(6단계)** 가 막혀 있을 수 있습니다.
> 개인 프로젝트라면 개인 Gmail 계정으로 진행하는 편이 수월합니다.

### 1. Firebase 프로젝트 만들기
1. <https://console.firebase.google.com> → **프로젝트 추가**
2. 프로젝트 이름 입력 (예: `tab-studio`) → Google 애널리틱스는 꺼도 됩니다
3. 만들어진 **프로젝트 ID**를 메모해 둡니다 (예: `tab-studio-1a2b3`)

### 2. Firestore 데이터베이스 만들기
1. 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치: `asia-northeast3 (서울)` 추천 — **나중에 바꿀 수 없습니다**
3. **프로덕션 모드**로 시작 (권한 규칙은 배포 시 `firestore.rules`로 덮어씁니다)

### 3. Google 로그인 켜기
1. **빌드 → Authentication → 시작하기**
2. **로그인 방법** 탭 → **Google** → 사용 설정 → 지원 이메일 선택 → 저장

### 4. 웹 앱 등록하고 설정값 붙여넣기
1. 프로젝트 개요 옆 ⚙️ → **프로젝트 설정 → 일반 → 내 앱 → 웹(`</>`)** 아이콘
2. 앱 닉네임 입력 → 등록 (Firebase Hosting 체크는 안 해도 됩니다)
3. 화면에 나오는 `firebaseConfig` 값을 **`public/js/firebase-config.js`** 에 그대로 붙여넣기
4. **`.firebaserc`** 의 `YOUR_PROJECT_ID`를 실제 프로젝트 ID로 바꾸기

> `firebaseConfig`의 apiKey는 공개돼도 되는 값입니다. 데이터 보호는 `firestore.rules`가 담당합니다.

### 5. GitHub 저장소 만들고 올리기
GitHub에서 새 저장소(예: `tab-studio`)를 만든 뒤, 이 폴더에서:

```bash
git init
git add .
git commit -m "TAB Studio 첫 커밋"
git branch -M main
git remote add origin https://github.com/<내아이디>/tab-studio.git
git push -u origin main
```

(아직 키를 등록하지 않았으므로 첫 Actions 실행은 실패해도 괜찮습니다.)

### 6. 배포용 서비스 계정 키 만들기
1. <https://console.cloud.google.com/iam-admin/serviceaccounts> → 상단에서 Firebase 프로젝트 선택
2. **서비스 계정 만들기** → 이름 `github-deploy`
3. 역할 3개 추가:
   - **Firebase 관리자** (Firebase Admin)
   - **서비스 사용량 소비자** (Service Usage Consumer)
   - **서비스 계정 사용자** (Service Account User)
4. 만든 계정 클릭 → **키 → 키 추가 → 새 키 만들기 → JSON** → 파일이 다운로드됨

> 이 JSON 파일은 비밀번호와 같습니다. 저장소에 커밋하지 마세요 (`.gitignore`에 `service-account*.json` 포함).

### 7. GitHub에 키와 프로젝트 ID 등록
GitHub 저장소 → **Settings → Secrets and variables → Actions**

| 종류 | 이름 | 값 |
|---|---|---|
| **Secrets** 탭 → New repository secret | `FIREBASE_SERVICE_ACCOUNT` | 6단계 JSON 파일 내용 전체 |
| **Variables** 탭 → New repository variable | `FIREBASE_PROJECT_ID` | 프로젝트 ID |

### 8. 배포
- **Actions** 탭 → `Deploy to Firebase` → **Run workflow** (또는 아무 커밋이나 `main`에 push)
- 완료되면 `https://<프로젝트ID>.web.app` 에서 접속할 수 있습니다
- 첫 배포 직후에는 Firestore 색인이 만들어지는 데 몇 분 걸려서, 필터·정렬 목록이 잠깐 오류를 낼 수 있습니다

이후로는 코드를 수정해서 `main`에 push할 때마다 자동으로 다시 배포됩니다.

---

## GitHub Actions 없이 내 컴퓨터에서 바로 배포하기 (대안)

6–7단계가 조직 정책 때문에 막히면 이 방법을 쓰세요. Node.js가 필요합니다.

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore
```

---

## 로컬에서 테스트하기 (실제 데이터에 영향 없음)

Java가 설치되어 있어야 합니다.

```bash
npx firebase-tools emulators:start --project demo-tab-studio
```

브라우저에서 <http://127.0.0.1:5000/?emu=1> 접속 → 가짜 로그인·가짜 DB로 동작합니다.
(`?emu=1`은 처음 한 번만 붙이면 그 탭에서 계속 유지됩니다.)

---

## 데이터 구조

| 컬렉션 | 내용 |
|---|---|
| `tabs/{id}` | 목록용 메타데이터: 제목, 아티스트, 악기(`guitar`/`bass4`/`bass5`), 튜닝, 카포, BPM, 작성자 이름·UID, 생성·수정 시각, 검색 키워드, 원본 ID(`forkOf`, 복사본일 때) |
| `tabBodies/{id}` | 악보 본문 (마디·코드·메모·가사 JSON 문자열) |

목록을 빠르게 불러오기 위해 본문을 따로 저장합니다. 두 문서는 항상 한 번에(배치로) 저장·삭제됩니다.

## 비용
Firebase 무료(Spark) 요금제로 충분합니다. Firestore는 하루 읽기 5만 회·쓰기 2만 회까지 무료이고,
목록 한 페이지(30개)를 열 때 약 30회 읽기가 발생합니다.

## 검색 동작
검색어의 **앞부분 일치**로 찾습니다 (예: `bohemian` → "Bohemian Rhapsody" ✓, `rhap` → ✓, `emian` → ✗).
여러 단어를 입력하면 모두 포함된 악보만 보여줍니다.
