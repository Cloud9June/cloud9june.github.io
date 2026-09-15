/* =========================================================
   firebase.js — Firebase 초기화 단일 지점
   모든 페이지가 이 모듈에서 auth / db 를 가져다 씁니다.
   (v1 처럼 파일마다 initializeApp 을 반복하지 않습니다)
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { FIREBASE_CONFIG } from "./config.js";

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);

/**
 * 오프라인 캐시.
 * v1 의 enableIndexedDbPersistence() 는 deprecated 이므로
 * 최신 persistentLocalCache 방식을 사용하고, 실패 시 기본 캐시로 물러납니다.
 * (시크릿 모드·다중 탭 제한 환경 대응)
 */
let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  console.warn("[firebase] 영구 캐시를 사용할 수 없어 메모리 캐시로 전환합니다.", e);
  _db = getFirestore(app);
}

export const db = _db;
