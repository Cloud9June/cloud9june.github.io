// ==========================================================
// 🔐 로그인 / 로그아웃 / 전체관리자 판별
//    UI 갱신에 필요한 요소를 넘겨받아 인증 상태를 반영하고,
//    상태가 바뀔 때마다 onChange 콜백으로 알려준다.
//
//    권한은 두 단계로 나뉜다.
//    1) 전체관리자 (settings/admin_list.emails) — 모든 실습실을 수정하고
//       실습실별 담당 선생님을 배정할 수 있다. (이 파일에서 판별)
//    2) 실습실 담당 선생님 (labs/{labId}.managers) — 배정된 실습실만 수정
//       가능하다. 이건 실습실별 데이터라 script.js에서 판별한다.
// ==========================================================
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

let isSuperAdmin = false;
let currentUserEmail = null;

/** 현재 로그인한 사용자가 전체관리자 명단(settings/admin_list)에 있는지 여부 */
export function getIsSuperAdmin() {
  return isSuperAdmin;
}

/** 현재 로그인한 사용자의 이메일 (로그인하지 않았으면 null) */
export function getUserEmail() {
  return currentUserEmail;
}

/**
 * 로그인 관련 UI를 초기화하고 인증 상태 변화를 구독한다.
 * @param {Object} els - { loginBtn, logoutBtn, userInfoEl, avatarEl }
 * @param {(isSuperAdmin: boolean) => void} onChange - 인증 상태가 갱신될 때마다 호출
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
      isSuperAdmin = false;
      currentUserEmail = null;
      userInfoEl.textContent = "로그인이 필요합니다";
      userInfoEl.classList.remove("is-admin");
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
      if (avatarEl) avatarEl.hidden = true;
      onChange(isSuperAdmin);
      return;
    }

    currentUserEmail = user.email;

    try {
      const adminSnap = await getDoc(doc(db, "settings", "admin_list"));
      const adminEmails = adminSnap.exists() ? adminSnap.data().emails || [] : [];
      isSuperAdmin = adminEmails.includes(user.email);
      if (!adminSnap.exists()) {
        console.warn("전체관리자 명단(settings/admin_list) 문서가 존재하지 않습니다.");
      }
    } catch (error) {
      // 권한 부족 등으로 admin_list를 읽지 못해도 일반 사용자로는 계속 이용 가능해야 함
      console.error("전체관리자 목록 확인 중 오류:", error);
      isSuperAdmin = false;
    }

    // 실습실 담당 선생님 여부는 실습실마다 달라서(labs/{id}.managers) 여기서는 판별하지 않는다.
    // 실습실 상세 화면에서 script.js가 판별해 표시한다.
    userInfoEl.textContent = isSuperAdmin ? `전체 관리자 · ${user.displayName}` : user.displayName;
    userInfoEl.classList.toggle("is-admin", isSuperAdmin);
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
    onChange(isSuperAdmin);
  });
}