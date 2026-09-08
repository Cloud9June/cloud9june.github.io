/* =========================================================
   repo/staff.js — 교직원 명부 (staff/roster)

   왜 필요한가
   v1 의 "미신청 인원" 은 mealRequests 문서 중 days 가 빈 것만 셌습니다.
   즉 **한 번도 페이지에 들어오지 않은 교사는 목록에 아예 안 나왔습니다.**
   관리자가 가장 알고 싶은 대상이 빠지는 셈이라, 기준이 되는 명부를
   별도 문서 하나로 관리합니다. (컬렉션이 아닌 단일 문서 → 규칙·조회 단순)
   ========================================================= */

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL } from "../config.js";

const rosterRef = () => doc(db, COL.STAFF, "roster");

/** @returns {Promise<Array<{name:string, email:string}>>} */
export async function getRoster() {
  try {
    const snap = await getDoc(rosterRef());
    if (!snap.exists() || !Array.isArray(snap.data().members)) return [];
    return snap.data().members
      .map((m) => ({
        name: String(m?.name ?? "").trim(),
        email: String(m?.email ?? "").trim().toLowerCase(),
      }))
      .filter((m) => m.email)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  } catch (e) {
    console.warn("[staff] 명부 조회 실패:", e);
    return [];
  }
}

export async function saveRoster(members) {
  const seen = new Set();
  const clean = [];
  for (const m of members) {
    const email = String(m.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    clean.push({ name: String(m.name || "").trim() || email.split("@")[0], email });
  }
  await setDoc(rosterRef(), { members: clean, updatedAt: serverTimestamp() });
  return clean;
}

/** "홍길동, hong@sungil-i.kr" 형태의 여러 줄 텍스트 → 배열 */
export function parseRosterText(text) {
  const out = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/[,\t]/).map((s) => s.trim());
    let name = "";
    let email = "";

    for (const part of parts) {
      if (part.includes("@")) email = part.toLowerCase();
      else if (!name) name = part;
    }
    if (!email) continue;
    out.push({ name: name || email.split("@")[0], email });
  }
  return out;
}

export function rosterToText(members) {
  return members.map((m) => `${m.name}, ${m.email}`).join("\n");
}

/**
 * 명부와 신청 내역을 대조해 미신청자를 찾습니다.
 * 명부가 비어 있으면(아직 등록 전) 신청 문서 기준으로만 판단합니다.
 *
 * @returns {{ noRequest:Array, emptyDays:Array, usingRoster:boolean }}
 *   noRequest — 명부에 있으나 신청 문서 자체가 없는 교사
 *   emptyDays — 문서는 있으나 신청일이 0일인 교사
 */
export function findNonApplicants(roster, requests) {
  const byEmail = new Map(requests.map((r) => [String(r.email || "").toLowerCase(), r]));
  const emptyDays = requests.filter((r) => r.days.length === 0);

  if (!roster.length) {
    return { noRequest: [], emptyDays, usingRoster: false };
  }

  const noRequest = roster
    .filter((m) => !byEmail.has(m.email))
    .map((m) => ({ name: m.name, email: m.email }));

  return { noRequest, emptyDays, usingRoster: true };
}
