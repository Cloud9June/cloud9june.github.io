/* =========================================================
   repo/settings.js — 월 오픈 상태 · 급식 미실시일 · 교사 신청 연도
   ========================================================= */

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL, MONTH_STATUS } from "../config.js";
import { monthKey, settingsKey } from "../util/date.js";

/* ---------------------------------------------------------
   월별 신청 상태 (mealSettings)
   문서 ID 는 v1 호환을 위해 0패딩 없는 `${y}-${m}` 을 씁니다.
   --------------------------------------------------------- */

function readStatus(snap) {
  if (!snap.exists()) return MONTH_STATUS.CLOSED;
  const data = snap.data();
  if (data.status !== undefined) return Number(data.status);
  // v1 초기 스키마 폴백: boolean active 만 있던 시절
  return data.active ? MONTH_STATUS.OPEN : MONTH_STATUS.CLOSED;
}

/** 해당 연도 1~12월 상태를 한 번에 조회 → { 1: 1, 2: 3, ... } */
export async function getMonthStatuses(year) {
  const snaps = await Promise.all(
    Array.from({ length: 12 }, (_, i) => getDoc(doc(db, COL.MEAL_SETTINGS, settingsKey(year, i + 1)))),
  );
  const result = {};
  snaps.forEach((snap, i) => { result[i + 1] = readStatus(snap); });
  return result;
}

export async function getMonthStatus(year, month) {
  const snap = await getDoc(doc(db, COL.MEAL_SETTINGS, settingsKey(year, month)));
  return readStatus(snap);
}

/**
 * 월 상태 저장.
 * v1 페이지들이 아직 boolean `active` 를 읽으므로 미러 필드를 함께 씁니다.
 * (v1 을 완전히 내린 뒤에는 active 를 제거해도 됩니다)
 */
export async function setMonthStatus(year, month, status) {
  await setDoc(
    doc(db, COL.MEAL_SETTINGS, settingsKey(year, month)),
    {
      status: Number(status),
      active: status === MONTH_STATUS.OPEN || status === MONTH_STATUS.READONLY, // v1 호환 미러
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/* ---------------------------------------------------------
   급식 미실시일 (blockedDays)
   --------------------------------------------------------- */

/** @returns {Promise<{days:number[], notes:Object<string,string>}>} */
export async function getBlocked(year, month) {
  const snap = await getDoc(doc(db, COL.BLOCKED_DAYS, monthKey(year, month)));
  if (!snap.exists()) return { days: [], notes: {} };

  const data = snap.data() || {};
  const days = Array.isArray(data.days)
    ? [...new Set(data.days.map(Number).filter(Number.isInteger))].sort((a, b) => a - b)
    : [];

  const notes = {};
  for (const [k, v] of Object.entries(data.notes || {})) {
    notes[String(Number(k))] = String(v ?? "");
  }
  return { days, notes };
}

export async function setBlocked(year, month, days, notes) {
  const cleanDays = [...new Set(days.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const cleanNotes = {};
  for (const d of cleanDays) {
    const text = String(notes?.[String(d)] ?? "").trim();
    cleanNotes[String(d)] = text || "급식 미실시";
  }
  // merge:false — 해제된 날의 메모가 남지 않도록 문서를 통째로 교체
  await setDoc(doc(db, COL.BLOCKED_DAYS, monthKey(year, month)), {
    days: cleanDays,
    notes: cleanNotes,
    updatedAt: serverTimestamp(),
  });
}

/* ---------------------------------------------------------
   교사 신청 대상 연도 (mealConfig/teacherYear)
   --------------------------------------------------------- */

export async function getTeacherYear(fallback = new Date().getFullYear()) {
  try {
    const snap = await getDoc(doc(db, COL.MEAL_CONFIG, "teacherYear"));
    const y = snap.exists() ? Number(snap.data().year) : NaN;
    return Number.isInteger(y) ? y : fallback;
  } catch (e) {
    console.error("[settings] teacherYear 조회 실패:", e);
    return fallback;
  }
}

export async function setTeacherYear(year) {
  await setDoc(
    doc(db, COL.MEAL_CONFIG, "teacherYear"),
    { year: Number(year), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
