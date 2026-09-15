/* =========================================================
   repo/requests.js — 교사 급식 신청 (mealRequests)

   경로: mealRequests/{YYYY-MM}/users/{docId}
   필드: { uid, name, email, days:number[], reasons:{dayStr:string},
           timestamp, updatedAt }

   ── 문서 ID 에 대하여 ────────────────────────────────────
   v1 은 `${표시이름}_${uid}` 를 문서 ID 로 씁니다. 교사가 구글 표시이름을
   바꾸면 새 문서가 생겨 같은 사람이 두 번 집계되는 버그가 있었습니다.

   v2 는 기존 서비스와 병행 운영해야 하므로 **쓰기는 v1 과 동일한 ID 규칙**을
   유지하고(둘이 서로 다른 문서를 만들면 즉시 중복 발생),
   **읽기 시점에 uid 기준으로 중복을 제거**해 집계 오류를 막습니다.
   v1 을 내린 뒤에는 requestDocId() 를 `user.uid` 반환으로 바꾸기만 하면 됩니다.
   ───────────────────────────────────────────────────────── */

import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL } from "../config.js";
import { monthKey, toDate } from "../util/date.js";

/** v1 호환 문서 ID */
export function requestDocId(user) {
  const base = user.displayName || String(user.email || "").split("@")[0];
  const safeName = String(base).replace(/\s+/g, "");
  return `${safeName}_${user.uid}`;
}

const usersCol = (year, month) =>
  collection(db, COL.MEAL_REQUESTS, monthKey(year, month), "users");

const userDoc = (year, month, docId) =>
  doc(db, COL.MEAL_REQUESTS, monthKey(year, month), "users", docId);

/**
 * 문서 → 표준 형태로 정규화.
 * - days 를 정수 유니크 오름차순으로
 * - reasons 는 "신청하지 않은 날" 에 대해서만 유효하게 (v1 이 merge 저장하며
 *   남긴 낡은 사유가 화면에 섞이지 않도록 읽는 쪽에서 정리)
 * - 이번 달 전체를 신청하지 않은 문서(days 가 0개)는 사유도 항상 빈 값으로 취급
 *   (정책상 전체 미신청은 사유가 필요 없음 — 예전 버그로 문서에 사유가 남아
 *   있더라도 화면에는 표시하지 않음)
 */
export function normalizeRequest(docId, raw) {
  const data = raw || {};
  const days = Array.isArray(data.days)
    ? [...new Set(data.days.map(Number).filter(Number.isInteger))].sort((a, b) => a - b)
    : [];
  const applied = new Set(days);

  const reasons = {};
  if (days.length > 0) {
    for (const [k, v] of Object.entries(data.reasons || {})) {
      const day = Number(k);
      if (!Number.isInteger(day) || applied.has(day)) continue;
      const text = String(v ?? "").trim();
      if (text) reasons[String(day)] = text;
    }
  }

  return {
    docId,
    uid: data.uid || docId,
    name: data.name || data.displayName || data.email || docId,
    email: data.email || "",
    days,
    reasons,
    updatedAt: toDate(data.updatedAt) || toDate(data.timestamp),
  };
}

/** 내 신청 내역 조회 */
export async function getMyRequest(user, year, month) {
  const snap = await getDoc(userDoc(year, month, requestDocId(user)));
  if (!snap.exists()) return null;
  return normalizeRequest(snap.id, snap.data());
}

/**
 * 내 신청 내역 저장.
 * merge 를 쓰지 않고 문서를 통째로 교체합니다. (merge:true 는 map 필드를
 * 깊게 병합하므로, 삭제한 사유가 문서에 그대로 남습니다)
 */
export async function saveMyRequest(user, year, month, { days, reasons }) {
  const cleanDays = [...new Set(days.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const applied = new Set(cleanDays);

  // 이번 달 전체를 신청하지 않는 경우(0일)는 사유가 필요 없는 정책이므로,
  // 화면 쪽 상태(state.reasons)에 무엇이 남아 있든 여기서 확실히 비웁니다.
  // (신청 화면을 오가며 지우는 걸 깜빡해도 저장 문서에는 절대 남지 않도록 하는 안전장치)
  const cleanReasons = {};
  if (cleanDays.length > 0) {
    for (const [k, v] of Object.entries(reasons || {})) {
      const day = Number(k);
      if (!Number.isInteger(day) || applied.has(day)) continue;
      const text = String(v ?? "").trim();
      if (text) cleanReasons[String(day)] = text.slice(0, 60);
    }
  }

  await setDoc(userDoc(year, month, requestDocId(user)), {
    uid: user.uid,
    name: user.displayName || String(user.email || "").split("@")[0],
    email: user.email || "",
    days: cleanDays,
    reasons: cleanReasons,
    timestamp: serverTimestamp(),   // v1 페이지가 읽는 필드명 유지
    updatedAt: serverTimestamp(),
  });

  return { days: cleanDays, reasons: cleanReasons };
}

/**
 * 해당 월 전체 신청 내역.
 * uid 기준으로 중복을 제거하고 가장 최근에 저장된 문서만 남깁니다.
 * @returns {Promise<Array>} normalizeRequest() 결과 배열
 */
export async function listMonthRequests(year, month) {
  const snap = await getDocs(usersCol(year, month));

  const byUid = new Map();
  snap.forEach((docSnap) => {
    const item = normalizeRequest(docSnap.id, docSnap.data());
    const prev = byUid.get(item.uid);
    if (!prev) { byUid.set(item.uid, item); return; }

    const prevTime = prev.updatedAt ? prev.updatedAt.getTime() : 0;
    const curTime = item.updatedAt ? item.updatedAt.getTime() : 0;
    if (curTime >= prevTime) byUid.set(item.uid, item);
  });

  return [...byUid.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 관리자: 특정 교사의 신청일 목록을 교체 */
export async function adminSetDays(year, month, docId, days) {
  const ref = userDoc(year, month, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("해당 교사의 신청 문서가 없습니다.");

  const cleanDays = [...new Set(days.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const applied = new Set(cleanDays);

  // 새로 신청 처리된 날의 미신청 사유는 자동으로 제거
  const reasons = {};
  for (const [k, v] of Object.entries(snap.data().reasons || {})) {
    if (!applied.has(Number(k))) reasons[k] = v;
  }

  await setDoc(ref, {
    ...snap.data(),
    days: cleanDays,
    reasons,
    updatedAt: serverTimestamp(),
  });

  return cleanDays;
}

/** 관리자: 하루 추가 */
export async function adminAddDay(year, month, docId, day) {
  const snap = await getDoc(userDoc(year, month, docId));
  if (!snap.exists()) throw new Error("해당 교사의 신청 문서가 없습니다.");
  const current = Array.isArray(snap.data().days) ? snap.data().days.map(Number) : [];
  if (current.includes(Number(day))) throw new Error("이미 신청된 날짜입니다.");
  return adminSetDays(year, month, docId, [...current, Number(day)]);
}

/** 관리자: 하루 취소 */
export async function adminRemoveDay(year, month, docId, day) {
  const snap = await getDoc(userDoc(year, month, docId));
  if (!snap.exists()) throw new Error("해당 교사의 신청 문서가 없습니다.");
  const current = Array.isArray(snap.data().days) ? snap.data().days.map(Number) : [];
  return adminSetDays(year, month, docId, current.filter((d) => d !== Number(day)));
}

/**
 * 날짜별 교사 신청 인원 { "3": 12, "4": 15, ... }
 * @param {Array} requests listMonthRequests() 결과 (중복 제거 완료본)
 */
export function countTeachersPerDay(requests) {
  const perDay = {};
  for (const req of requests) {
    for (const day of req.days) {
      const key = String(day);
      perDay[key] = (perDay[key] || 0) + 1;
    }
  }
  return perDay;
}

/**
 * 날짜별 미신청 사유 목록
 * @returns {Object<string, Array<{name:string, email:string, reason:string}>>}
 */
export function groupReasonsByDay(requests) {
  const byDay = {};
  for (const req of requests) {
    for (const [dayStr, reason] of Object.entries(req.reasons)) {
      (byDay[dayStr] ||= []).push({ name: req.name, email: req.email, reason });
    }
  }
  for (const list of Object.values(byDay)) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }
  return byDay;
}
