# S:NOW v2

성일정보고등학교 학생용 공지 웹앱. 스마트폰 우선, 선생님은 PC 관리 콘솔.

기존 v1 은 그대로 두고 이 폴더(`/stu/v2/`)에서 먼저 확인한 뒤,
문제가 없으면 파일들을 `/stu/` 로 옮기면 됩니다.

---

## 1. 무엇이 달라졌나

**보안** — 이전에는 권한이 브라우저 안에만 있었습니다. 이제 전부 서버에서 막습니다.

| 항목 | v1 | v2 |
|---|---|---|
| 권한 판정 | 브라우저 `currentPrivileges` 배열 | `firestore.rules` 가 `users/{email}` 문서를 읽어 판정 |
| 신원 | `localStorage.userInfo` (조작 가능) | Firebase 인증 상태 + Firestore 명부 |
| 명부 조회 | 무인증 Apps Script 웹앱 | Firestore `users` 컬렉션 (규칙으로 보호) |
| 본문 렌더링 | `innerHTML` 문자열 조립 | `textContent` + `createElement` (XSS 불가) |
| 작성자 | 위조 가능 | 규칙이 `authorEmail == 로그인 이메일` 강제 |
| 확인 처리 | 남의 번호도 제거 가능 | 규칙이 "본인 번호 하나만" 강제 |
| 읽기 권한 | 아무 구글 계정 | 학교 계정 + 명부 등록자만 |

**구조** — 월별 컬렉션(`feeds/2025-10/items`)을 없앴습니다.
매월 1일마다 지난달 글의 수정·삭제가 실패하던 버그와 페이지네이션 모순이 사라집니다.

```
feeds/{id}                       전체 피드
classFeeds/{classKey}/items/{id} 반별 피드   (classKey 예: "2-3")
externalFeeds/{id}               대외 피드
users/{email}                    명부 + 권한
```

**디자인** — 탭별 색 정체성은 유지하고 레이아웃을 새로 짰습니다.
색은 `<html data-tab="...">` 하나로 앱 전체(하단 탭바·워드마크·글쓰기 버튼·태그)에 번집니다.

---

## 2. 파일

```
v2/
├─ index.html            학생·선생님 앱 (모바일 우선)
├─ admin.html            관리 콘솔 (PC)
├─ manifest.json         PWA 설정
├─ service-worker.js     HTML은 네트워크 우선, 정적 자원은 캐시 우선
├─ firestore.rules       ★ Firebase 콘솔에 붙여넣을 보안 규칙
├─ css/
│  ├─ app.css            디자인 토큰 + 앱 전체 스타일
│  └─ admin.css          관리 콘솔 추가 스타일
├─ js/
│  ├─ config.js          설정과 고정 데이터 (로직 없음)
│  ├─ firebase.js        SDK 초기화
│  ├─ auth.js            로그인 · 권한 (화면 표시용 판정)
│  ├─ db.js              Firestore 접근 (DOM 을 모름)
│  ├─ render.js          데이터 → DOM (innerHTML 없음)
│  ├─ ui.js              토스트 · 시트 · 테마 · 당겨서 새로고침
│  ├─ app.js             학생 앱 진입점
│  └─ admin.js           관리 콘솔
└─ tools/
   └─ 명부_내보내기.gs   기존 시트 → 붙여넣기용 텍스트
```

아이콘과 영상은 기존 `/stu/icons/`, `/stu/video/` 를 그대로 씁니다.

---

## 3. 적용 순서

### 3-1. 먼저 (오늘)

기존 Apps Script 웹앱을 **중지**하세요. 인증 없이 학생 이름·학년·반·번호가 조회됩니다.

> Apps Script → 배포 → 배포 관리 → 해당 배포 → **보관처리**

`random.html` 도 서버에서 내려 주세요. 학생 18명의 실명과 학번이 평문으로 들어 있습니다.

### 3-2. 명부 옮기기

1. 명부 스프레드시트에서 `tools/명부_내보내기.gs` 실행 → `S:NOW_붙여넣기` 시트 생성
2. `admin.html` 을 열고 **총관리자 계정**으로 로그인
3. 명부·권한 → **일괄 등록** → A열 복사한 것을 붙여넣고 등록

> 처음에는 `users` 컬렉션이 비어 있어 아무도 로그인할 수 없습니다.
> Firebase 콘솔에서 본인 문서를 **손으로 한 개** 먼저 만들어 주세요.
>
> 문서 ID: `june@sungil-i.kr`
> ```
> name      (string)  김형준
> role      (string)  교사
> grade     (number)  2
> class     (number)  3
> classKey  (string)  2-3
> privilege (array)   ["총관리자"]
> ```
>
> 선생님 문서에는 `number` 를 넣지 마세요. 번호는 학생의 확인 처리에만 쓰입니다.

### 3-3. 보안 규칙 배포

`firestore.rules` 내용을 Firebase 콘솔 → Firestore → 규칙에 붙여넣고 게시합니다.

**붙여넣기 전에 테스트를 먼저 돌리세요.** `tests/` 에 38개 시나리오가 준비되어 있습니다.

```bash
cd tests
npm install     # 처음 한 번만 (Java 11 이상 필요)
npm test        # 에뮬레이터가 자동으로 켜졌다 꺼집니다
```

Windows 라면 `tests\테스트-실행.bat` 을 더블클릭해도 됩니다.
실제 `sungilnow` 프로젝트에는 접속하지 않으므로 데이터가 바뀌지 않습니다.

무엇을 확인하는지, 실패하면 무엇을 봐야 하는지는 `tests/README.md` 에 있습니다.
특히 **"학생이 자기 번호를 빼는 것은 허용된다"** 는 꼭 통과를 확인하고 배포하세요.
중요 알림 확인 기능 전체가 규칙의 그 한 줄에 걸려 있습니다.

테스트가 다루는 범위:

| 묶음 | 내용 |
|---|---|
| 1. 접근 자체 | 외부 구글 계정 · 명부 미등록 계정 · 비로그인 차단 |
| 2. 글쓰기 권한 | 학생/반장/담임/관리자가 각 피드에 쓰고 지울 수 있는지 |
| 3. 문서 위조 | 작성자 위조, 시각 위조, 허용 안 된 필드, 길이 초과 |
| 4. 반별 열람 | 다른 반 피드 차단, 교사는 전체 열람 |
| 5. 중요 알림 | 본인 번호만 제거, 남의 번호·통째 비우기 차단 |
| 6. 명부 | 총관리자만 편집, 학생의 권한 상승 차단, 반별 목록 조회 |

### 3-4. 파일 올리기

`v2/` 폴더째 서버에 올려 `https://eduinfo.sungil-i.kr/stu/v2/` 로 확인합니다.
문제가 없으면 `v2/` 안의 내용을 `/stu/` 로 옮기고 `manifest.json` 의 `id` 는 그대로 두세요.

기존 서비스워커 캐시 때문에 옛 화면이 보이면, 브라우저 개발자도구 →
Application → Service Workers → Unregister 후 새로고침하면 됩니다.

### 3-5. 마무리 (권장)

- Firebase 콘솔 → **App Check** 를 reCAPTCHA v3 로 활성화 (외부 스크립트 접근 차단)
- Firebase 콘솔 → **예산 알림** 설정 (읽기 폭주 시 알림)
- Google 로그인 공급자에서 승인된 도메인 확인

---

## 4. 권한 이름

관리 콘솔에서 붙일 수 있는 권한입니다. 규칙과 코드가 이 문자열을 그대로 씁니다.

| 권한 | 할 수 있는 일 |
|---|---|
| `총관리자` | 전부 + 명부 편집 |
| `관리자` | 전체·대외 피드 작성·수정·삭제, 모든 반 피드 열람 |
| `담임` | 자기 반 피드 작성·수정·삭제, 확인 현황 열람 |
| `반장` / `부반장` | 자기 반 피드 작성·수정·삭제 |
| (없음) | 열람과 중요 알림 확인만 |

`role` 이 `교사` 면 담임이 아니어도 모든 반 피드를 **열람**할 수 있습니다.

---

## 5. 알아 두면 좋은 것

**규칙이 users 문서를 읽습니다.** 요청마다 문서 읽기가 1회 추가되지만 같은 요청 안에서는
캐시됩니다. 학교 규모에서는 무료 할당량 안입니다. 나중에 Cloud Functions 를 쓰게 되면
`firestore.rules` 의 헬퍼 함수(`me()`, `has()`, `myClass()`)만 커스텀 클레임 방식으로
바꾸면 되고, 나머지 규칙은 그대로 둘 수 있습니다.

**키오스크 모드**는 `index.html?kiosk=true` 로 켭니다. 하단 탭바와 글쓰기 버튼이 사라지고
카드가 격자로 크게 배치됩니다.

**본문에 링크**를 넣으면 `config.js` 의 `TRUSTED_LINK_HOSTS` 에 있는 도메인만 링크가 됩니다.
그 외 주소는 클릭되지 않는 텍스트로 남습니다. 필요한 도메인은 이 목록에 추가하세요.

---

## 6. 로그인이 안 될 때

v2 는 `index.html` 상단에 CSP(콘텐츠 보안 정책)를 넣었습니다. XSS 2차 방어선이지만,
너무 좁게 잡으면 구글 로그인 자체가 막힙니다. 실제로 초기 버전에서 `apis.google.com`
이 빠져 로그인이 실패했습니다. (`signInWithPopup` 이 인증 이벤트용 iframe을 만들 때
`https://apis.google.com/js/api.js` 를 불러옵니다.)

로그인 실패 토스트에 **괄호 안 오류 코드**가 함께 표시됩니다. 코드별 대처:

| 오류 코드 | 원인과 조치 |
|---|---|
| `auth/internal-error` | CSP 가 로그인 스크립트를 막음. `script-src` 에 `https://apis.google.com` 이 있는지 확인 |
| `auth/unauthorized-domain` | 지금 접속한 주소가 Firebase 승인 목록에 없음. **콘솔 → Authentication → 설정 → 승인된 도메인**에 추가 |
| `auth/popup-blocked` | 브라우저 팝업 차단. 주소창에서 허용 |
| `auth/operation-not-allowed` | 콘솔에서 Google 로그인 공급자가 꺼져 있음 |
| `auth/network-request-failed` | 네트워크 문제 |

**로컬에서 테스트할 때 주의**: Firebase 는 기본적으로 `localhost` 만 승인합니다.
`127.0.0.1:5500` 처럼 IP 로 열면 `auth/unauthorized-domain` 이 납니다.
`http://localhost:5500/...` 으로 여시거나, 승인된 도메인에 `127.0.0.1` 을 추가하세요.

CSP 때문에 막히는 것이 의심되면 개발자도구 Console 에 빨간 글씨로
`Refused to load the script ...` 처럼 어떤 지시어가 막았는지 정확히 찍힙니다.
그 줄을 보고 해당 도메인을 CSP 에 추가하면 됩니다.
