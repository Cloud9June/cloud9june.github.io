/* ============================================================
   config.js — 설정과 고정 데이터만. 로직 없음.
   ============================================================ */

export const APP_VERSION = "2.0.2";

/* Firebase 설정: 공개되는 값이 맞습니다.
   실제 보안 경계는 firestore.rules 와 App Check 입니다. */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA_ufzFnMFovKW0JhNyrXWYV2a_1cCt5Vs",
  authDomain: "sungilnow.firebaseapp.com",
  projectId: "sungilnow",
  storageBucket: "sungilnow.appspot.com",
  messagingSenderId: "458932138557",
  appId: "1:458932138557:web:f1a508865261ffaafbf054",
};

export const SCHOOL_DOMAIN = "sungil-i.kr";
export const PAGE_SIZE = 15;

/* 본문에서 링크로 만들어 줄 도메인.
   hostname 과 "정확히" 일치할 때만 링크가 됩니다. */
export const TRUSTED_LINK_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
  "forms.gle",
  "sites.google.com",
  "sungil-i.kr",
  "eduinfo.sungil-i.kr",
]);

/* 전체 피드 공개대상 태그 */
export const PRESET_TAGS = [
  "#전교생공개", "#1학년만", "#2학년만", "#3학년만",
  "#뷰티스마트케어과", "#부사관과", "#금융경영과", "#회계정보과",
  "#창업마케팅과", "#AI게임콘텐츠과", "#스마트웹콘텐츠과", "#소프트웨어개발과",
];

/* 탭 정의 — 색은 CSS 의 [data-tab] 에서 가져옵니다. */
export const TABS = {
  all:      { title: "전체",   sub: "학교 전체 공지" },
  class:    { title: "우리반", sub: "우리 반 전용 알림" },
  external: { title: "대외",   sub: "누구나 볼 수 있는 소식" },
  more:     { title: "더보기", sub: "내 정보와 도움말" },
};

/* 권한 이름 */
export const PRIV = {
  SUPER: "총관리자",
  ADMIN: "관리자",
  HOMEROOM: "담임",
  LEAD: "반장",
  SUBLEAD: "부반장",
};

/* 도움말 — 화면에 그대로 뿌려집니다. HTML 태그는 넣지 마세요. */
export const HELP = [
  {
    icon: "📱",
    title: "홈 화면에 추가해서 앱처럼 쓰기",
    body:
`안드로이드 · 크롬: 메뉴(⋮) → "홈 화면에 추가"
아이폰 · 사파리: 공유(⬆️) → "홈 화면에 추가"

추가하면 주소창 없이 앱처럼 열리고, 다음부터는 아이콘만 눌러 바로 들어올 수 있습니다.`,
  },
  {
    icon: "🗂",
    title: "탭마다 무엇이 있나요",
    body:
`전체 — 학교 전체에 나가는 공지입니다. 태그를 눌러 우리 학년·학과 것만 골라 볼 수 있습니다.
우리반 — 내 학년·반에만 보이는 알림입니다. 담임 선생님과 반장이 씁니다.
대외 — 로그인하지 않아도 볼 수 있는 학교 소식입니다.
더보기 — 내 정보, 화면 밝기, 도움말이 있습니다.`,
  },
  {
    icon: "✅",
    title: "중요 알림 확인하기",
    body:
`우리반 탭에 빨간 "중요" 표시가 붙은 글은 반 전체가 확인해야 하는 알림입니다.

글 아래 "확인했어요"를 누르면 내 번호가 목록에서 사라집니다.
담임 선생님은 아직 확인하지 않은 번호를 한눈에 볼 수 있습니다.
확인은 한 번만 누르면 되고, 기기를 바꿔도 그대로 유지됩니다.`,
  },
  {
    icon: "✏️",
    title: "글쓰기 권한",
    body:
`전체 · 대외 — 관리자 권한을 가진 선생님
우리반 — 담임 선생님, 반장, 부반장

권한이 없으면 글쓰기 버튼이 보이지 않습니다.
권한 변경이 필요하면 교육정보부로 문의해 주세요.`,
  },
  {
    icon: "🔄",
    title: "새 글이 안 보일 때",
    body:
`화면 맨 위에서 아래로 당기면 새로고침됩니다.
그래도 안 보이면 앱을 완전히 닫았다가 다시 열어 주세요.`,
  },
  {
    icon: "ⓘ",
    title: "만든 사람",
    body:
`S:NOW — 성일정보고등학교 학생용 웹앱
제작 · 운영: 교육정보부 김형준
버전: ${APP_VERSION}

© 2026 성일정보고등학교. 무단 복제 및 배포를 금합니다.`,
  },
];
