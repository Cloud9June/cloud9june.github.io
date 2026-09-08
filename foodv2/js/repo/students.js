/* =========================================================
   repo/students.js — 학생 급식 인원 (studentsDaily / studentAbsences)

   v1 대비 핵심 변경
   1) studentsDailyEffective(차감 반영본)를 "진실의 원천"으로 삼지 않습니다.
      v1 은 mealstudents.html 에서만 이 문서를 갱신했기 때문에, 관리자가
      급식 미실시일을 바꾸거나 결석표를 고쳐도 총원 페이지가 낡은 값을
      그대로 읽는 문제가 있었습니다.
      → v2 는 항상 base + 결석 + 미실시일로 **읽는 시점에 계산**합니다.
      → 다만 v1 페이지가 아직 살아 있으므로 계산 결과를 미러로 써 둡니다.
   2) 월 경계를 넘는 결석 기간(8/28~9/2)이 통째로 누락되던 버그를
      clampRangeToMonth() 로 해결했습니다.
   ========================================================= */

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL } from "../config.js";
import {
  monthKey, getSchoolDays, clampRangeToMonth, toCount, isWeekend,
} from "../util/date.js";
import { getBlocked } from "./settings.js";

const baseRef = (y, m) => doc(db, COL.STUDENTS_DAILY, monthKey(y, m));
const effectiveRef = (y, m) => doc(db, COL.STUDENTS_DAILY_EFFECTIVE, monthKey(y, m));
const absencesRef = (y, m) => doc(db, COL.STUDENT_ABSENCES, monthKey(y, m));

function normalizeDaysMap(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const day = Number(k);
    if (!Number.isInteger(day)) continue;
    out[String(day)] = toCount(v);
  }
  return out;
}

/* ---------------------------------------------------------
   기준 인원 (studentsDaily)
   --------------------------------------------------------- */

export async function getStudentBase(year, month) {
  const snap = await getDoc(baseRef(year, month));
  if (!snap.exists()) return {};
  return normalizeDaysMap(snap.data().days);
}

/**
 * 등교일 전체를 같은 인원으로 채우기.
 * merge 를 쓰지 않고 문서를 교체하므로, 나중에 미실시일로 지정된 날짜에
 * 옛 숫자가 남아 있는 문제가 생기지 않습니다.
 */
export async function fillMonth(year, month, value, blockedDays = null) {
  const blocked = blockedDays ?? (await getBlocked(year, month)).days;
  const count = toCount(value);

  const days = {};
  for (const d of getSchoolDays(year, month, blocked)) days[String(d)] = count;

  await setDoc(baseRef(year, month), { days, updatedAt: serverTimestamp() });
  return days;
}

/** 하루치만 수정 */
export async function saveStudentDay(year, month, day, value) {
  await setDoc(
    baseRef(year, month),
    { days: { [String(day)]: toCount(value) }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/* ---------------------------------------------------------
   결석/체험학습 등 차감 항목 (studentAbsences)
   --------------------------------------------------------- */

/** @returns {Promise<Array<{situation:string,count:number,start:string,end:string}>>} */
export async function getAbsences(year, month) {
  const snap = await getDoc(absencesRef(year, month));
  if (!snap.exists() || !Array.isArray(snap.data().items)) return [];
  return snap.data().items.map((it) => ({
    situation: String(it?.situation ?? it?.reason ?? "").trim(),
    count: toCount(it?.count),
    start: String(it?.start ?? ""),
    end: String(it?.end ?? ""),
  }));
}

export async function saveAbsences(year, month, items) {
  await setDoc(absencesRef(year, month), {
    items: items.map((it) => ({
      situation: String(it.situation || "").trim().slice(0, 60),
      count: toCount(it.count),
      start: String(it.start || ""),
      end: String(it.end || ""),
    })),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 결석 항목 → 날짜별 차감 인원 맵.
 * 기간이 이번 달을 걸치기만 하면 겹치는 구간을 잘라 반영합니다.
 */
export function computeDeductions(items, year, month, blocked = []) {
  const blockedSet = new Set(blocked.map(Number));
  const deduct = {};

  for (const item of items) {
    const range = clampRangeToMonth(item.start, item.end, year, month);
    const count = toCount(item.count);
    if (!range || count <= 0) continue;

    for (let d = range.sDay; d <= range.eDay; d++) {
      if (isWeekend(year, month, d) || blockedSet.has(d)) continue;
      const key = String(d);
      deduct[key] = (deduct[key] || 0) + count;
    }
  }
  return deduct;
}

/* ---------------------------------------------------------
   실제 급식 인원 계산 (읽는 시점 계산)
   --------------------------------------------------------- */

/**
 * @returns {Promise<{
 *   base:Object, blocked:number[], notes:Object, absences:Array,
 *   deduct:Object, effective:Object, schoolDays:number[]
 * }>}
 */
export async function loadStudentMonth(year, month) {
  const [base, blockedDoc, absences] = await Promise.all([
    getStudentBase(year, month),
    getBlocked(year, month),
    getAbsences(year, month),
  ]);

  const blocked = blockedDoc.days;
  const schoolDays = getSchoolDays(year, month, blocked);
  const deduct = computeDeductions(absences, year, month, blocked);

  const effective = {};
  for (const d of schoolDays) {
    const key = String(d);
    effective[key] = Math.max(0, toCount(base[key]) - toCount(deduct[key]));
  }

  return { base, blocked, notes: blockedDoc.notes, absences, deduct, effective, schoolDays };
}

/**
 * v1 호환 미러 저장.
 * 기존 mealtotal.html 이 studentsDailyEffective 를 우선 읽으므로,
 * v2 에서 값이 바뀔 때마다 이 문서도 갱신해 두 시스템의 숫자를 일치시킵니다.
 * (v1 을 완전히 내리면 이 함수는 삭제해도 됩니다)
 */
export async function mirrorEffective(year, month, effective) {
  try {
    await setDoc(effectiveRef(year, month), {
      days: effective,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[students] v1 호환 미러 저장 실패(무시 가능):", e);
  }
}

/** 계산 + 미러 저장을 한 번에 */
export async function refreshEffective(year, month) {
  const result = await loadStudentMonth(year, month);
  await mirrorEffective(year, month, result.effective);
  return result;
}
