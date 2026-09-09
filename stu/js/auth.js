/* ============================================================
   auth.js — 로그인 상태와 권한.

   중요: 여기서 계산하는 권한은 "화면에 버튼을 보여줄지" 만 결정합니다.
   실제 차단은 전부 firestore.rules 가 서버에서 합니다.
   localStorage 는 표시용 캐시일 뿐, 신원의 근거가 아닙니다.
   ============================================================ */
import {
  signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { auth, db, provider } from "./firebase.js";
import { SCHOOL_DOMAIN, PRIV } from "./config.js";

const GUEST_KEY = "snow.guest";

/** 현재 세션. profile 은 Firestore users/{email} 문서입니다. */
export const session = {
  user: null,      // Firebase Auth 사용자
  profile: null,   // { name, role, grade, class, classKey, number, privilege[] }
  guest: false,
};

/* ── 조회 헬퍼 ─────────────────────────────────────────── */
const privs = () => session.profile?.privilege ?? [];

/** 승인 대기 중인가 (교사 신청 후 총관리자 승인 전) */
export const isPending   = () => session.profile?.status === "pending";
const activeProfile      = () => (isPending() ? null : session.profile);

export const has        = (p) => !isPending() && privs().includes(p);
export const isSuper    = () => has(PRIV.SUPER);
export const isAdmin    = () => isSuper() || has(PRIV.ADMIN);
export const isTeacher  = () => activeProfile()?.role === "교사";
export const isStudent  = () => activeProfile()?.role === "학생";
export const isHomeroom = () => has(PRIV.HOMEROOM);
export const isClassLead= () => has(PRIV.LEAD) || has(PRIV.SUBLEAD);
export const myClassKey = () => activeProfile()?.classKey || "";
export const myNumber   = () => {
  const n = session.profile?.number;
  return typeof n === "number" ? n : null;
};

/** 탭을 볼 수 있는지 */
export function canView(tab) {
  if (tab === "external" || tab === "more") return true;
  if (session.guest || !session.profile) return false;
  if (tab === "all") return true;
  if (tab === "class") return !!myClassKey() || isTeacher();
  return false;
}

/** 탭에 글을 쓸 수 있는지 (규칙과 같은 기준) */
export function canWrite(tab) {
  if (!session.profile) return false;
  if (isAdmin()) return true;
  if (tab === "class") return !!myClassKey() && (isHomeroom() || isClassLead());
  return false;
}

/** 글을 수정·삭제할 수 있는지 */
export const canManage = (tab) => canWrite(tab);

/* ── 로그인 / 로그아웃 ─────────────────────────────────── */

export async function signIn() {
  const { user } = await signInWithPopup(auth, provider);
  if (!user.email?.endsWith("@" + SCHOOL_DOMAIN)) {
    await signOut(auth);
    throw new Error("SCHOOL_ONLY");
  }
  return user;
}

/** 로그인 실패 원인을 사람이 읽을 수 있게. null 이면 조용히 넘어갑니다. */
export function loginErrorMessage(err) {
  if (err?.message === "SCHOOL_ONLY") return "학교 계정(@sungil-i.kr)으로만 로그인할 수 있습니다.";

  switch (err?.code) {
    // 사용자가 팝업을 닫은 것 — 오류가 아닙니다
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return null;

    case "auth/unauthorized-domain":
      return "이 주소가 Firebase 승인 목록에 없습니다. Authentication → 설정 → 승인된 도메인에 추가하세요.";
    case "auth/popup-blocked":
      return "브라우저가 팝업을 막았습니다. 주소창의 팝업 차단을 해제한 뒤 다시 눌러 주세요.";
    case "auth/operation-not-allowed":
      return "Firebase 콘솔에서 Google 로그인이 꺼져 있습니다.";
    case "auth/network-request-failed":
      return "네트워크에 연결하지 못했습니다. 인터넷 상태를 확인해 주세요.";
    case "auth/internal-error":
      return "로그인 모듈을 불러오지 못했습니다. 페이지의 CSP 설정에 apis.google.com 이 빠졌는지 확인하세요.";
    default:
      return `로그인에 실패했습니다. (${err?.code || err?.message || "알 수 없는 오류"})`;
  }
}

export async function leave() {
  localStorage.removeItem(GUEST_KEY);
  session.guest = false;
  await signOut(auth);
}

export function enterGuest() {
  localStorage.setItem(GUEST_KEY, "1");
  session.guest = true;
  session.user = null;
  session.profile = null;
}

export function exitGuest() {
  localStorage.removeItem(GUEST_KEY);
  session.guest = false;
}

export const wasGuest = () => localStorage.getItem(GUEST_KEY) === "1";

/* ── 세션 감시 ─────────────────────────────────────────── */

/**
 * Firebase 인증 상태가 이 앱의 유일한 진입점입니다.
 * @param {(state:{status:'in'|'out'|'unknown'}) => void} onChange
 */
export function watchSession(onChange) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      session.user = null;
      session.profile = null;
      onChange({ status: session.guest ? "guest" : "out" });
      return;
    }

    if (!user.email?.endsWith("@" + SCHOOL_DOMAIN)) {
      await signOut(auth);
      onChange({ status: "out", reason: "SCHOOL_ONLY" });
      return;
    }

    session.user = user;
    session.guest = false;
    localStorage.removeItem(GUEST_KEY);

    // onChange 는 try 밖에서 호출합니다.
    // 안에서 부르면 화면 그리기 오류까지 "명부 조회 실패"로 둔갑합니다.
    let outcome;
    try {
      const snap = await getDoc(doc(db, "users", user.email));
      if (snap.exists()) {
        session.profile = normalize(snap.data(), user);
        outcome = { status: "in" };
      } else {
        // 명부에 없으면 내보내지 않고 "본인 등록" 화면으로 보냅니다.
        // (로그인 세션이 살아 있어야 본인 문서를 만들 수 있습니다)
        session.profile = null;
        outcome = { status: "register" };
      }
    } catch (err) {
      console.error("[auth] 명부 조회 실패", err);
      outcome = { status: "out", reason: "PROFILE_FAIL" };
    }
    onChange(outcome);
  });
}

/** 명부 문서를 앱이 기대하는 모양으로 정리 */
function normalize(data, user) {
  const priv = Array.isArray(data.privilege)
    ? data.privilege
    : typeof data.privilege === "string"
      ? data.privilege.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

  const grade = num(data.grade);
  const klass = num(data.class);

  return {
    email: user.email,
    name: String(data.name || user.displayName || "이름 없음"),
    role: data.role === "교사" ? "교사" : "학생",
    grade,
    class: klass,
    classKey: data.classKey || (grade && klass ? `${grade}-${klass}` : ""),
    number: num(data.number),
    privilege: priv,
    status: data.status === "pending" ? "pending" : "active",
    selfRegistered: data.selfRegistered === true,
  };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 화면에 보여줄 이름 */
export function displayName() {
  const p = session.profile;
  if (!p) return "게스트";
  if (p.role === "교사") return `${p.name} 선생님`;
  if (p.classKey && p.number) return `${p.classKey.replace("-", "학년 ")}반 ${p.number}번 ${p.name}`;
  return p.name;
}

/** 아바타에 넣을 두 글자 */
export function initials() {
  const p = session.profile;
  if (!p) return "G";
  return p.name.slice(-2);
}
