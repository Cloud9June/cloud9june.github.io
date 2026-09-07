// ==========================================================
// 🔧 Firebase 초기화 (프로젝트 전체가 공유하는 단일 인스턴스)
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEKQSLrBp1rtwpJCu6dqrFv24Lf43hJ4s",
  authDomain: "com-lab-d1d2f.firebaseapp.com",
  projectId: "com-lab-d1d2f",
  storageBucket: "com-lab-d1d2f.firebasestorage.app",
  messagingSenderId: "914308651372",
  appId: "1:914308651372:web:2107a6851de180c46dbb49",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);