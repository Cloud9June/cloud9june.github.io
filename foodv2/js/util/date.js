/* =========================================================
   util/date.js — 날짜 계산 유틸 (전 페이지 공용)

   ⚠️ 문서 ID 규칙 (v1 데이터와 호환되어야 함)
     - mealSettings  : `${y}-${m}`   ← 0패딩 없음
     - 그 외 전부    : `${y}-${MM}`  ← 0패딩 있음
   두 규칙을 각각 settingsKey() / monthKey() 로 고정해 실수를 차단합니다.
   ========================================================= */

export const pad2 = (n) => String(n).padStart(2, "0");

/** blockedDays · mealRequests · studentsDaily · totals … 공용 월 키 */
export const monthKey = (y, m) => `${y}-${pad2(m)}`;

/** mealSettings 전용 월 키 (v1 레거시 포맷) */
export const settingsKey = (y, m) => `${y}-${m}`;

export const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

export const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 'YYYY-MM-DD' 를 로컬 타임존 기준으로 파싱 (new Date(str) 의 UTC 해석 회피) */
export function parseISODateLocal(str) {
  if (typeof str !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/** 해당 월 1일의 요일 (0=일 … 6=토) */
export const firstDowOfMonth = (y, m) => new Date(y, m - 1, 1).getDay();

export const dowOf = (y, m, d) => new Date(y, m - 1, d).getDay();

export function isWeekend(y, m, d) {
  const w = dowOf(y, m, d);
  return w === 0 || w === 6;
}

/**
 * 급식 실시일(등교일) 목록.
 * 주말과 blockedDays 를 제외한 평일만 반환합니다.
 */
export function getSchoolDays(y, m, blocked = []) {
  const blockedSet = new Set(blocked.map(Number));
  const out = [];
  const last = daysInMonth(y, m);
  for (let d = 1; d <= last; d++) {
    if (isWeekend(y, m, d)) continue;
    if (blockedSet.has(d)) continue;
    out.push(d);
  }
  return out;
}

/**
 * 달력 그리드용 셀 배열.
 * 앞쪽 빈칸 개수 + 1~말일을 한 번에 계산합니다.
 * @returns {{padCount:number, days:number[], last:number}}
 */
export function buildMonthGrid(y, m) {
  return {
    padCount: firstDowOfMonth(y, m),
    days: Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1),
    last: daysInMonth(y, m),
  };
}

/**
 * 기간(startISO~endISO)을 해당 월 범위로 잘라 일(day) 범위를 반환.
 *
 * v1 의 toDayOfMonth() 는 시작일 또는 종료일이 다른 달이면 null 을 돌려주어
 * 8/28~9/2 같은 월 경계 결석이 **양쪽 달 모두에서 통째로 누락**되는 버그가 있었습니다.
 * 여기서는 겹치는 구간만 잘라내어 정확히 반영합니다.
 *
 * @returns {{sDay:number, eDay:number} | null}  겹치지 않으면 null
 */
export function clampRangeToMonth(startISO, endISO, y, m) {
  const s = parseISODateLocal(startISO);
  const e = parseISODateLocal(endISO);
  if (!s || !e || s > e) return null;

  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  if (e < monthStart || s > monthEnd) return null;

  return {
    sDay: s < monthStart ? 1 : s.getDate(),
    eDay: e > monthEnd ? monthEnd.getDate() : e.getDate(),
  };
}

/** 0 이상 정수로 안전 변환 */
export function toCount(v, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
  if (typeof v === "string") {
    const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  }
  return fallback;
}

/** 연속 숫자를 "1~3, 7, 10~12" 형태로 압축 */
export function formatDayRanges(days) {
  const sorted = [...new Set(days.map(Number))].filter(Number.isInteger).sort((a, b) => a - b);
  if (!sorted.length) return "";
  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) { prev = cur; continue; }
    parts.push(start === prev ? `${start}일` : `${start}~${prev}일`);
    start = cur;
    prev = cur;
  }
  return parts.join(", ");
}

/** Firestore Timestamp | Date | number → Date | null */
export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 선택 가능한 연도 목록 (올해 기준 ±1) */
export function yearOptions(base = new Date().getFullYear(), back = 1, forward = 1) {
  const out = [];
  for (let y = base - back; y <= base + forward; y++) out.push(y);
  return out;
}
