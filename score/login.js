// login.js (공통 로그인 처리 + Firebase 초기화)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =============================
// 🔥 Firebase 초기화
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyA_ufzFnMFovKW0JhNyrXWYV2a_1cCt5Vs",
  authDomain: "sungilnow.firebaseapp.com",
  projectId: "sungilnow",
  storageBucket: "sungilnow.appspot.com",
  messagingSenderId: "458932138557",
  appId: "1:458932138557:web:f1a508865261ffaafbf054"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// =============================
// 🔐 로그인 기능
// =============================
export async function doLogin() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!user.email.endsWith("@sungil-i.kr")) {
      alert("학교 계정(@sungil-i.kr)으로만 로그인하세요.");
      await signOut(auth);
      return null;
    }

    // 로그인 유지용
    localStorage.setItem("email", user.email);
    localStorage.setItem("isLoggedIn", "true");

    return user.email;
  } catch (error) {
    console.error("로그인 오류:", error);
    alert("로그인에 실패했습니다.");
    return null;
  }
}

// =============================
// 🚪 로그아웃 기능
// =============================
export async function doLogout() {
  await signOut(auth);
  localStorage.clear();
  location.href = "index.html";
}

// =============================
// 🔎 로그인 상태 확인 함수
// =============================
export function checkLogin(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.email.endsWith("@sungil-i.kr")) {
      localStorage.setItem("email", user.email);
      localStorage.setItem("isLoggedIn", "true");
      callback(user.email);
    } else {
      localStorage.clear();
      callback(null);
    }
  });
}
