/* =========================================================
   util/errors.js — Firebase 오류를 사람이 읽을 수 있는 안내로 변환

   "저장에 실패했습니다" 만 띄우면 원인을 알 수 없어, 실제 코드와
   해결 방법을 함께 보여 줍니다.
   ========================================================= */

const MESSAGES = {
  "permission-denied":
    "Firestore 보안 규칙이 이 작업을 막았습니다. 규칙에 해당 컬렉션이 있는지, " +
    "그리고 roles/{내 이메일} 문서의 role 값이 admin 인지 확인하세요.",
  unauthenticated:
    "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  unavailable:
    "네트워크에 연결하지 못했습니다. 인터넷 상태를 확인한 뒤 다시 시도해 주세요.",
  "failed-precondition":
    "브라우저 오프라인 캐시를 사용할 수 없는 상태입니다. 다른 탭을 닫거나 시크릿 창을 종료한 뒤 다시 시도해 주세요.",
  "not-found":
    "대상 문서를 찾을 수 없습니다.",
  "invalid-argument":
    "저장하려는 데이터 형식이 올바르지 않습니다.",
  "resource-exhausted":
    "Firestore 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  "deadline-exceeded":
    "응답 시간이 초과되었습니다. 다시 시도해 주세요.",
};

/** 토스트 한 줄용 요약 (코드 포함) */
export function errorMessage(e, prefix = "") {
  const code = e?.code || "";
  const known = MESSAGES[code.replace(/^firestore\//, "")];
  const detail = known || e?.message || "알 수 없는 오류";
  const codeText = code ? ` (${code})` : "";
  return `${prefix}${prefix ? " — " : ""}${detail}${codeText}`;
}

/** 배너·다이얼로그용 상세 (제목 / 설명 / 코드) */
export function errorDetail(e, title = "작업에 실패했습니다") {
  const code = e?.code || "";
  const known = MESSAGES[code.replace(/^firestore\//, "")];
  return {
    title,
    desc: known || e?.message || "알 수 없는 오류가 발생했습니다.",
    code,
  };
}

export function isPermissionDenied(e) {
  return String(e?.code || "").includes("permission-denied");
}

/**
 * 오래 걸리는 저장을 사용자에게 알리는 타이머.
 *
 * Firestore 의 setDoc() 프라미스는 **서버가 응답할 때까지 resolve 되지 않습니다.**
 * 즉 네트워크가 끊기면 «저장 중…» 상태로 무한정 멈춰 있게 됩니다.
 * (오프라인 캐시 덕분에 연결이 회복되면 자동으로 전송되긴 하지만,
 *  그 사이 사용자는 저장이 됐는지 안 됐는지 알 수 없습니다)
 *
 * 사용법
 *   const cancel = warnIfSlow(12000, () => toast("...", "warn"));
 *   try { await 저장(); } finally { cancel(); }
 *
 * @returns {() => void} 타이머 취소 함수
 */
export function warnIfSlow(ms, callback) {
  const timer = setTimeout(callback, ms);
  return () => clearTimeout(timer);
}
