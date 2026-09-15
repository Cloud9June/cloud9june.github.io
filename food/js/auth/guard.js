/* =========================================================
   auth/guard.js — 인증 · 권한 게이트

   v1 문제점과 개선
   1) onAuthStateChanged 콜백 안에 초기화 로직을 넣어, 토큰 갱신 등으로
      콜백이 재발화하면 <option> 이 중복 생성되거나 Firestore 쓰기가
      중복 실행되었습니다. → 여기서는 "1회성 Promise" 로 감쌉니다.
   2) 페이지마다 도메인 규칙이 달랐습니다. → config.js 상수 하나로 통일.

   ⚠️ 이 게이트는 어디까지나 UI 편의 장치입니다.
      실제 접근 제어는 firestore.rules 가 담당해야 합니다.
   ========================================================= */

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "../firebase.js";
import { ALLOWED_DOMAINS, ADMIN_DOMAINS, COL, ROUTES } from "../config.js";

/** 현재 로그인 상태를 딱 한 번만 확인 (구독을 즉시 해제) */
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => { unsubscribe(); resolve(user || null); },
      (err) => { console.error("[auth] 상태 확인 실패:", err); unsubscribe(); resolve(null); },
    );
  });
}

export function domainOf(email) {
  const at = String(email || "").lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

export const isAllowedDomain = (email) => ALLOWED_DOMAINS.includes(domainOf(email));
export const isAdminDomain = (email) => ADMIN_DOMAINS.includes(domainOf(email));

/** roles/{email}.role === "admin" 여부 */
export async function checkAdmin(email) {
  if (!email || !isAdminDomain(email)) return false;
  try {
    const snap = await getDoc(doc(db, COL.ROLES, email));
    return snap.exists() && snap.data().role === "admin";
  } catch (e) {
    console.error("[auth] roles 조회 실패:", e);
    return false;
  }
}

export function displayNameOf(user) {
  if (!user) return "";
  return user.displayName || String(user.email || "").split("@")[0];
}

export async function logout(redirectTo = ROUTES.LOGIN) {
  try { await signOut(auth); } catch (e) { console.error("[auth] 로그아웃 실패:", e); }
  location.replace(redirectTo);
}

/** 리다이렉트 후에는 호출자의 후속 코드가 절대 실행되지 않도록 영원히 pending */
function halt() {
  return new Promise(() => {});
}

/**
 * 페이지 진입 게이트.
 *
 * @param {{ requireAdmin?: boolean }} options
 * @returns {Promise<{ user: object, email: string, name: string, isAdmin: boolean }>}
 */
export async function requireAccess({ requireAdmin = false } = {}) {
  const user = await waitForAuth();

  if (!user) {
    location.replace(ROUTES.LOGIN);
    return halt();
  }

  const email = user.email || "";

  if (!isAllowedDomain(email)) {
    await signOut(auth);
    location.replace(`${ROUTES.LOGIN}?error=domain`);
    return halt();
  }

  const admin = await checkAdmin(email);

  if (requireAdmin && !admin) {
    location.replace(`${ROUTES.APPLY}?error=forbidden`);
    return halt();
  }

  return { user, email, name: displayNameOf(user), isAdmin: admin };
}
