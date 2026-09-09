/* ============================================================
   firebase.js — SDK 초기화. 다른 파일은 여기서만 가져다 씁니다.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { FIREBASE_CONFIG, SCHOOL_DOMAIN } from "./config.js";

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const provider = new GoogleAuthProvider();
/* 계정 선택 화면에서부터 학교 계정만 보이게 합니다.
   (편의 기능일 뿐이고, 실제 차단은 보안 규칙이 합니다.) */
provider.setCustomParameters({ hd: SCHOOL_DOMAIN, prompt: "select_account" });
