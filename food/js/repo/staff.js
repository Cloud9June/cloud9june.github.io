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

/**
 * 명부 조회.
 * 실패하면 예외를 그대로 던집니다 — 호출하는 화면이 원인(권한/네트워크)을
 * 사용자에게 보여줄 수 있어야 하기 때문입니다.
 * 명부가 없어도 나머지 기능은 동작해야 하는 화면에서는 getRosterSafe() 를 쓰세요.
 *
 * @returns {Promise<Array<{name:string, email:string}>>}
 */
export async function getRoster() {
  const snap = await getDoc(rosterRef());
  if (!snap.exists() || !Array.isArray(snap.data().members)) return [];
  return snap.data().members
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      email: String(m?.email ?? "").trim().toLowerCase(),
    }))
    .filter((m) => m.email)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 조회 실패를 빈 명부로 처리 (명부가 없어도 나머지가 동작해야 하는 화면용) */
export async function getRosterSafe() {
  try {
    return await getRoster();
  } catch (e) {
    console.warn("[staff] 명부 조회 실패 — 빈 명부로 진행합니다:", e);
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

/**
 * "홍길동, hong@sungil-i.kr" 형태의 여러 줄 텍스트를 파싱합니다.
 * 쉼표(,) · 탭 · 세미콜론(;) · 전각쉼표(，) · 공백 여러 칸을 모두 구분자로 봅니다.
 *
 * @returns {{members: Array<{name:string,email:string}>, skipped: Array<{line:number,text:string,why:string}>}}
 *   skipped — 이메일을 못 찾아 건너뛴 줄. 화면에 그대로 보여 주면 원인 파악이 쉽습니다.
 */
export function parseRosterLines(text) {
  const members = [];
  const skipped = [];
  const seen = new Set();

  const lines = String(text || "").split(/\r?\n/);

  // 구분자(공백·쉼표·세미콜론·탭·전각쉼표)를 포함하지 않는 실제 이메일만 추출
  const EMAIL_RE = /[^\s,;，、\t]+@[^\s,;，、\t]+\.[^\s,;，、\t]+/;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    /*
       구분자를 먼저 쪼개지 않고 이메일부터 찾습니다.
       "김영희 kim@sungil-i.kr" 처럼 공백 한 칸으로 붙여 쓴 경우,
       구분자 기준으로 나누면 줄 전체가 이메일로 잡히기 때문입니다.
    */
    const found = line.match(EMAIL_RE);

    if (!found) {
      const why = line.includes("@")
        ? "이메일 형식이 올바르지 않음 (도메인에 . 이 없음)"
        : "이메일(@)을 찾지 못함";
      skipped.push({ line: index + 1, text: line, why });
      return;
    }

    const email = found[0].toLowerCase();

    // 이메일을 뺀 나머지에서 이름을 추출 (구분자와 여분 공백 제거)
    const name = line
      .replace(found[0], " ")
      .replace(/[,;，、\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(email)) {
      skipped.push({ line: index + 1, text: line, why: "이메일 중복" });
      return;
    }

    seen.add(email);
    members.push({ name: name || email.split("@")[0], email });
  });

  return { members, skipped };
}

/** 하위 호환용 — 회원 배열만 필요할 때 */
export function parseRosterText(text) {
  return parseRosterLines(text).members;
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
