// ==========================================================
// 🔐 로그인 / 로그아웃 / 관리자 판별
//    UI 갱신에 필요한 요소를 넘겨받아 인증 상태를 반영하고,
//    상태가 바뀔 때마다 onChange 콜백으로 알려준다.
// ==========================================================
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

let isAdmin = false;

/** 현재 로그인한 사용자가 관리자 명단(settings/admin_list)에 있는지 여부 */
export function getIsAdmin() {
  return isAdmin;
}

/**
 * 로그인 관련 UI를 초기화하고 인증 상태 변화를 구독한다.
 * @param {Object} els - { loginBtn, logoutBtn, userInfoEl, avatarEl }
 * @param {(isAdmin: boolean) => void} onChange - 인증 상태가 갱신될 때마다 호출
 */
export function initAuth({ loginBtn, logoutBtn, userInfoEl, avatarEl }, onChange) {
  loginBtn.addEventListener("click", () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
      console.error("로그인 에러:", error);
      alert("로그인에 실패했습니다: " + error.message);
    });
  });

  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => location.reload())
      .catch((error) => console.error("로그아웃 에러:", error));
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      isAdmin = false;
      userInfoEl.textContent = "로그인이 필요합니다";
      userInfoEl.classList.remove("is-admin");
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
      if (avatarEl) avatarEl.hidden = true;
      document.body.classList.add("is-guest");
      onChange(isAdmin);
      return;
    }

    try {
      const adminSnap = await getDoc(doc(db, "settings", "admin_list"));
      const adminEmails = adminSnap.exists() ? adminSnap.data().emails || [] : [];
      isAdmin = adminEmails.includes(user.email);
      if (!adminSnap.exists()) {
        console.warn("관리자 명단(settings/admin_list) 문서가 존재하지 않습니다.");
      }
    } catch (error) {
      // 권한 부족 등으로 admin_list를 읽지 못해도 일반 사용자로는 계속 이용 가능해야 함
      console.error("관리자 목록 확인 중 오류:", error);
      isAdmin = false;
    }

    userInfoEl.textContent = isAdmin ? `관리자 · ${user.displayName}` : `손님(학생) · ${user.displayName}`;
    userInfoEl.classList.toggle("is-admin", isAdmin);
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.src = user.photoURL;
        avatarEl.hidden = false;
      } else {
        avatarEl.hidden = true;
      }
    }
    document.body.classList.toggle("is-guest", !isAdmin);
    onChange(isAdmin);
  });
}