/* =========================================================
   pages/login.js — 구글 로그인
   ========================================================= */

import {
  GoogleAuthProvider, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "../firebase.js";
import { ALLOWED_DOMAINS, ROUTES } from "../config.js";
import { el, icon, render, toast, initTheme, createThemeToggle } from "../util/dom.js";
import { waitForAuth, isAllowedDomain } from "../auth/guard.js";

initTheme();

const errorSlot = document.getElementById("errorSlot");
const actionSlot = document.getElementById("actionSlot");
const metaSlot = document.getElementById("metaSlot");

document.getElementById("loginMark").appendChild(icon("utensils", 26));
document.getElementById("themeSlot").appendChild(createThemeToggle());

render(metaSlot,
  el("div", null, `허용 도메인 · ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(" · ")}`),
  el("div", null, "개인 계정으로는 로그인할 수 없습니다."),
);

/* ---------- 진입 시 안내 메시지 ---------- */

const params = new URLSearchParams(location.search);
const errorMessages = {
  domain: {
    title: "교내 계정이 아닙니다",
    desc: `${ALLOWED_DOMAINS.map((d) => `@${d}`).join(", ")} 계정으로 다시 로그인해 주세요.`,
  },
  forbidden: {
    title: "접근 권한이 없습니다",
    desc: "관리자 권한이 있는 계정만 들어갈 수 있는 페이지입니다.",
  },
  session: {
    title: "로그인이 만료되었습니다",
    desc: "다시 로그인해 주세요.",
  },
};

const initialError = errorMessages[params.get("error")];
if (initialError) showBanner("warn", initialError.title, initialError.desc);

function showBanner(tone, title, desc) {
  render(errorSlot,
    el("div", { class: `banner banner--${tone} login__error` },
      el("span", { class: "banner__icon" }, icon(tone === "danger" ? "alert" : "info", 16)),
      el("div", { class: "banner__body" },
        el("div", { class: "banner__title" }, title),
        desc ? el("div", { class: "banner__desc" }, desc) : null,
      ),
    ),
  );
}

function clearBanner() { render(errorSlot); }

/* ---------- 로그인 버튼 ---------- */

const googleMark = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  const paths = [
    ["#4285F4", "M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"],
    ["#34A853", "M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"],
    ["#FBBC05", "M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"],
    ["#EA4335", "M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"],
  ];
  for (const [fill, d] of paths) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("fill", fill);
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
};

const loginBtn = el("button", {
  class: "btn btn--primary btn-google",
  type: "button",
  onClick: handleLogin,
}, googleMark(), "Google 계정으로 로그인");

render(actionSlot, loginBtn);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

async function handleLogin() {
  clearBanner();
  loginBtn.disabled = true;
  loginBtn.replaceChildren(el("span", { class: "btn__spinner" }), "로그인 중…");

  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email || "";

    if (!isAllowedDomain(email)) {
      await signOut(auth);
      showBanner("warn", "교내 계정이 아닙니다",
        `${email} 은(는) 허용되지 않은 도메인입니다.`);
      return;
    }

    toast(`${result.user.displayName || "선생님"}님 환영합니다`, "ok", 1600);
    location.replace(ROUTES.APPLY);
  } catch (e) {
    console.error("[login] 실패:", e);

    if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") {
      showBanner("info", "로그인이 취소되었습니다", "다시 시도해 주세요.");
    } else if (e?.code === "auth/popup-blocked") {
      showBanner("warn", "팝업이 차단되었습니다", "브라우저 주소창의 팝업 차단을 해제한 뒤 다시 시도해 주세요.");
    } else {
      showBanner("danger", "로그인에 실패했습니다", e?.message || "잠시 후 다시 시도해 주세요.");
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.replaceChildren(googleMark(), "Google 계정으로 로그인");
  }
}

/* ---------- 이미 로그인되어 있으면 바로 이동 ---------- */

(async () => {
  const user = await waitForAuth();
  if (user && isAllowedDomain(user.email) && !initialError) {
    location.replace(ROUTES.APPLY);
  }
})();
