# 급식 관리 시스템 v2

기존(v1) 서비스를 그대로 둔 채, **같은 Firestore 데이터를 공유하는 새 버전**입니다.
`meal-v2/` 폴더 하나만 올리면 되고, 기존 파일은 건드리지 않습니다.

---

## 1. 폴더 구조

```
meal-v2/
├── index.html              로그인
├── apply.html              교사 급식 신청  (구 meal.html)
├── admin.html              관리자 (탭 4개, iframe 없음)
├── firestore.rules         ★ 보안 규칙 — 가장 먼저 배포하세요
│
├── css/
│   ├── tokens.css          색·타이포·간격 토큰 (라이트/다크)
│   ├── base.css            리셋·타이포그래피·레이아웃
│   ├── components.css      버튼·카드·표·토스트·다이얼로그…
│   └── calendar.css        달력 그리드 (반응형 전부 CSS)
│
└── js/
    ├── config.js           Firebase 설정·도메인·컬렉션명·상태코드
    ├── firebase.js         초기화 단일 지점
    ├── util/
    │   ├── date.js         날짜 계산·문서 ID 규칙
    │   └── dom.js          el()·아이콘·토스트·다이얼로그·테마
    ├── auth/guard.js       로그인·도메인·관리자 게이트
    ├── ui/shell.js         공통 헤더
    ├── repo/               ← Firestore 접근은 전부 여기서만
    │   ├── settings.js     월 상태·미실시일·신청 연도
    │   ├── requests.js     교사 신청
    │   ├── students.js     학생 인원·결석 차감
    │   ├── staff.js        교직원 명부
    │   └── totals.js       총원 집계
    └── pages/
        ├── login.js
        ├── apply.js
        └── admin/{settings,teachers,students,totals}-view.js
```

**화면(pages)은 Firestore를 직접 호출하지 않습니다.** 모든 읽기·쓰기는 `repo/`를
거치므로, 스키마를 바꿀 때 고칠 파일이 한 곳입니다.

---

## 2. 배포

```bash
# 1) 보안 규칙 먼저 (가장 중요)
firebase deploy --only firestore:rules

# 2) 정적 파일
#    public/meal-v2/ 아래에 폴더째 복사한 뒤
firebase deploy --only hosting
```

접속 주소는 `https(도메인)/meal-v2/` 가 됩니다.
기존 주소(`/index.html` 등)는 그대로 살아 있습니다.

> **로컬 테스트 시 주의**: ES 모듈은 `file://` 로 열면 CORS 때문에 동작하지 않습니다.
> `npx serve` 또는 `firebase serve` 로 띄워 주세요.

---

## 3. 새 기능 — 미신청 사유

교사가 특정 날짜에 급식을 신청하지 않으면, 그 날 **왜 신청하지 않는지**를
입력하게 했습니다.

| 위치 | 동작 |
|---|---|
| 신청 화면 달력 | 미신청 날짜 아래 «사유 입력» 버튼. 빨간 점선 = 미입력, 주황 = 입력됨 |
| 사유 입력 | 프리셋 칩(출장·연가·조퇴…) + 자유 입력, 최대 60자 |
| 툴바 | «미입력 사유 한 번에 채우기» — 비어 있는 날 전체에 같은 사유 일괄 적용 |
| 저장 시 | 비어 있는 사유가 있으면 목록을 보여주고 «사유 입력하기 / 사유 없이 저장» 선택 |
| 관리자 · 교사 신청 현황 | 교사별 사유 컬럼 + «일자별 미신청 사유» 섹션 |
| 관리자 · 총원 집계 | 특이사항 요약에 «교사 미신청 사유» 포함 |

**저장 형태** — 기존 신청 문서에 필드 하나만 추가됩니다.

```js
mealRequests/2026-09/users/{docId} = {
  uid, name, email,
  days: [1, 2, 5, 8],
  reasons: { "3": "출장", "4": "연가" },   // ← 신규
  timestamp, updatedAt
}
```

v1 페이지는 `reasons`를 읽지 않으므로 **기존 서비스에 아무 영향이 없습니다.**

---

## 4. 리팩토링 반영 내역

### 보안
- `firestore.rules` 신규 작성 — 교사는 자기 문서만, 관리자만 설정 변경, **마감된 달 저장 차단**
- 도메인 검사를 `config.js` 상수 하나로 통일 (v1은 페이지마다 달랐음)
- `innerHTML` 제거 → `el()` 기반 DOM 생성으로 XSS 경로 차단
- iframe 게이트 우회 문제 해결 (iframe 자체를 없앰)

### 버그
- **월 경계 결석 누락** — 8/28~9/2 체험학습이 양쪽 달에서 통째로 빠지던 문제 (`clampRangeToMonth`)
- **표시이름 변경 시 중복 집계** — 읽을 때 `uid` 기준 중복 제거
- **연/월을 바꿔도 총원이 안 바뀜** — 셀렉트 변경 시 즉시 재계산
- **`onAuthStateChanged` 재발화** — 1회성 Promise로 초기화 중복 차단
- **리사이즈 시 선택 유실** — 반응형을 CSS로 이전, JS 재렌더 제거
- **월 연타 시 경쟁 조건** — 렌더 토큰으로 낡은 응답 폐기
- **`every()` 안에서 `sort()` 반복 호출** — 사전 정렬로 교체
- **`studentsDailyEffective`가 낡은 값** — 읽는 시점에 계산 (v1 호환 미러는 유지)
- **기준 인원 오염** — 달력은 기준 인원만 편집, 차감은 읽기 전용 표시

### 성능·비용
- 같은 컬렉션을 3번 읽던 총원 페이지 → **1번**
- 화면 열 때마다 발생하던 `totals` 쓰기 제거 → 버튼 눌렀을 때만
- `+`/`−` 연타 시 쓰기 폭주 → 500ms 디바운스
- `enableIndexedDbPersistence`(deprecated) → `persistentLocalCache`

### UX
- `alert`/`confirm`/`prompt` 전부 제거 → 토스트 + `<dialog>`
- 로딩 스켈레톤, 에러 배너, 빈 상태 화면 추가
- 저장하지 않은 변경사항 보호(달 이동·페이지 이탈 경고)
- 되돌리기 버튼, CSV 내려받기
- 키보드 접근성(모든 조작이 `<button>`), `aria-*` 속성
- 라이트/다크 테마 자동 + 수동 토글

---

## 5. v1과 병행 운영 시 주의점

| 항목 | 처리 |
|---|---|
| `mealSettings` 문서 ID | v1 규칙(`2026-9`, 0패딩 없음) 유지 |
| `mealRequests` 문서 ID | v1 규칙(`이름_uid`) 유지 — 둘이 다르면 즉시 중복 발생 |
| `mealSettings.active` | v1이 읽으므로 `status`와 함께 계속 기록 |
| `studentsDailyEffective` | v1 총원 페이지가 읽으므로 v2에서 값이 바뀔 때마다 미러 저장 |
| `totals.strings` | v1이 읽으므로 저장 시 함께 기록 |

**v1을 완전히 내린 뒤 정리할 것**
1. `js/repo/requests.js` → `requestDocId()`를 `user.uid` 반환으로 변경 + 기존 문서 마이그레이션
2. `js/repo/settings.js` → `active` 필드 기록 제거
3. `js/repo/students.js` → `mirrorEffective()` 및 `studentsDailyEffective` 컬렉션 삭제
4. `js/repo/totals.js` → `strings` 기록 제거
5. `meal_bak.html` 삭제 (하드코딩된 관리자 이메일 + 구 스키마 쓰기 위험)

---

## 6. 첫 실행 시 설정 순서

1. `firestore.rules` 배포
2. Firebase 콘솔에서 `roles/{관리자이메일}` 문서에 `{ role: "admin" }` 생성
3. `/meal-v2/admin.html` 접속 → **월 · 미실시일 설정** 탭
   - 교사 신청 대상 연도 저장
   - 신청받을 달을 «신청중»으로 전환
   - 급식 미실시일 체크
   - **교직원 명부 입력** (한 줄에 `이름, 이메일`)
4. 교사에게 `/meal-v2/` 주소 안내

> 3-④ 명부를 넣어야 «한 번도 접속하지 않은 교사»까지 미신청자로 잡힙니다.
> v1은 이 기준이 없어서, 정작 가장 확인이 필요한 사람이 목록에서 빠졌습니다.

---

## 7. 알려진 제약

- **급식 추가 신청**은 해당 교사가 한 번이라도 신청 화면에 접속해 문서가 생성된
  뒤에만 가능합니다. 접속 전에 관리자가 임의로 문서를 만들면 나중에 본인이
  로그인할 때 `uid`가 달라 중복 문서가 생기기 때문입니다.
- 보안 규칙의 `monthIsOpen()`은 `mealSettings`와 `mealRequests`의 문서 ID 규칙이
  다른 탓에 문자열 변환을 씁니다. 배포 전 **규칙 플레이그라운드에서 반드시
  테스트**하세요. 문제가 생기면 해당 조건만 빼도 나머지 규칙은 정상 동작합니다.
