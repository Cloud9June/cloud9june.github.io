/* =========================================================
   config.js — 프로젝트 전역 상수 (단일 소스)
   ========================================================= */

/**
 * Firebase 웹 설정.
 * apiKey 는 공개 식별자이므로 노출되어도 무방합니다.
 * 실제 보안은 반드시 firestore.rules 로 강제해야 합니다.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRAOzrMccWaw-l5Z6YtHgpW9Gr80UTRhw",
  authDomain: "mealmanager-cda3b.firebaseapp.com",
  projectId: "mealmanager-cda3b",
};

/** 로그인 허용 도메인. 모든 페이지가 이 배열 하나만 참조합니다. */
export const ALLOWED_DOMAINS = ["sungil-i.kr"];

/** 관리자 페이지 접근을 허용할 도메인 (교내 주 도메인만) */
export const ADMIN_DOMAINS = ["sungil-i.kr"];

/** 월별 신청 상태 */
export const MONTH_STATUS = {
  OPEN: 1,      // 신청/수정 가능
  READONLY: 2,  // 마감 — 조회만 가능
  CLOSED: 3,    // 미오픈 — 진입 불가
};

export const MONTH_STATUS_LABEL = {
  1: "신청중",
  2: "조회전용",
  3: "미오픈",
};

/** 상태 순환 순서 (관리자가 버튼을 누를 때) */
export const MONTH_STATUS_CYCLE = [
  MONTH_STATUS.CLOSED,
  MONTH_STATUS.OPEN,
  MONTH_STATUS.READONLY,
];

/**
 * Firestore 컬렉션 이름.
 * ⚠️ 기존(v1) 서비스와 동일한 컬렉션을 공유하므로 절대 변경하지 마세요.
 */
export const COL = {
  ROLES: "roles",
  STAFF: "staff",                                   // v2 신규 (교직원 명부)
  MEAL_CONFIG: "mealConfig",
  MEAL_SETTINGS: "mealSettings",                    // 문서 ID: `${y}-${m}`  (0패딩 없음, v1 호환)
  BLOCKED_DAYS: "blockedDays",                      // 문서 ID: `${y}-${MM}`
  MEAL_REQUESTS: "mealRequests",                    // `${y}-${MM}` / users / {docId}
  STUDENTS_DAILY: "studentsDaily",                  // `${y}-${MM}`
  STUDENTS_DAILY_EFFECTIVE: "studentsDailyEffective",// `${y}-${MM}` — v1 호환용 미러
  STUDENT_ABSENCES: "studentAbsences",              // `${y}-${MM}`
  TOTALS: "totals",                                 // `${y}-${MM}`
};

/** 미신청 사유 빠른 선택 프리셋 */
export const REASON_PRESETS = [
  "출장",
  "연가",
  "조퇴",
  "외부 회의",
  "개인 사정",
  "학교 행사",
];

/** 저장 디바운스(ms) — 잦은 Firestore 쓰기 방지 */
export const SAVE_DEBOUNCE_MS = 500;

/** 페이지 경로 */
export const ROUTES = {
  LOGIN: "index.html",
  APPLY: "apply.html",
  ADMIN: "admin.html",
};
