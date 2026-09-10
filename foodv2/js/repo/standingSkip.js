/* =========================================================
   repo/standingSkip.js — 장기 미신청 (mealStandingSkip)

   교사가 "이번 달부터 남은 학년도 동안 계속 급식을 신청하지 않는다"고
   한 번 등록하면, 그 뒤로는 매달 들어와서 0일로 저장하지 않아도
   자동으로 미신청 처리되게 하는 기능입니다.

   경로: mealStandingSkip/{uid}  (mealRequests 와 달리 uid 를 그대로 문서 ID 로
        씁니다 — v1 이 모르는 v2 전용 신규 데이터라 v1 호환 ID 규칙이 필요 없습니다)

   ── 적용 범위 판단 ──────────────────────────────────────
   문서에는 등록 당시의 "학년도(teacherYear)"와 "그 달"을 그대로 저장해 둡니다.
   어떤 (year, month) 화면을 열든:
     - doc.active 가 true 이고
     - doc.year 가 지금 보고 있는 year 와 같고
     - month 가 doc.fromMonth 이상이면
   장기 미신청이 적용된 것으로 봅니다.

   인사이동으로 관리자가 teacherYear 를 다음 해로 바꾸면, 저장되어 있던
   doc.year 와 더 이상 일치하지 않으므로 별도 정리 없이 자동으로 무효화됩니다.
   ───────────────────────────────────────────────────────── */

import {
  doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL } from "../config.js";
import { toDate } from "../util/date.js";

const skipRef = (uid) => doc(db, COL.MEAL_STANDING_SKIP, uid);

function normalize(uid, raw) {
  const data = raw || {};
  const year = Number(data.year);
  const fromMonth = Number(data.fromMonth);
  return {
    uid,
    name: data.name || "",
    email: data.email || "",
    active: Boolean(data.active) && Number.isInteger(year) && Number.isInteger(fromMonth),
    year: Number.isInteger(year) ? year : null,
    fromMonth: Number.isInteger(fromMonth) ? fromMonth : null,
    updatedAt: toDate(data.updatedAt),
  };
}

/** 내 장기 미신청 등록 상태 조회. 등록된 적 없으면 null. */
export async function getMyStandingSkip(user) {
  const snap = await getDoc(skipRef(user.uid));
  if (!snap.exists()) return null;
  return normalize(snap.id, snap.data());
}

/**
 * 특정 (year, month) 화면에 장기 미신청이 실제로 적용되는지 판단합니다.
 * (그 달에 실제 신청 문서가 있는지는 호출하는 쪽에서 별도로 우선 검사해야 합니다 —
 *  실제 저장된 문서가 있으면 이 값과 무관하게 항상 그 문서가 우선입니다.)
 */
export function isStandingSkipActive(skip, year, month) {
  if (!skip || !skip.active) return false;
  return skip.year === year && month >= skip.fromMonth;
}

/** 장기 미신청 등록 (또는 갱신) */
export async function setStandingSkip(user, year, month) {
  await setDoc(skipRef(user.uid), {
    uid: user.uid,
    name: user.displayName || String(user.email || "").split("@")[0],
    email: user.email || "",
    active: true,
    year: Number(year),
    fromMonth: Number(month),
    updatedAt: serverTimestamp(),
  });
}

/** 장기 미신청 해제 */
export async function clearStandingSkip(user) {
  await deleteDoc(skipRef(user.uid));
}

/**
 * 관리자용: 전체 장기 미신청 등록 목록.
 * @returns {Promise<Array>} normalize() 결과 배열 (활성 상태만)
 */
export async function listStandingSkips() {
  const snap = await getDocs(collection(db, COL.MEAL_STANDING_SKIP));
  const out = [];
  snap.forEach((docSnap) => {
    const item = normalize(docSnap.id, docSnap.data());
    if (item.active) out.push(item);
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
