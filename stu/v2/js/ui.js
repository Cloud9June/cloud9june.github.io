/* ============================================================
   ui.js — 토스트 · 바텀시트 · 테마 · 당겨서 새로고침.
   alert / confirm 은 쓰지 않습니다 (키오스크에서 화면이 잠깁니다).
   ============================================================ */
import { el } from "./render.js";

/* ── 토스트 ────────────────────────────────────────────── */
const toastHost = () => document.getElementById("toasts");

export function toast(message, kind = "ok", ms = 2600) {
  const node = el("div", { class: "toast" + (kind === "bad" ? " toast--bad" : ""), text: message });
  toastHost().append(node);
  setTimeout(() => {
    node.style.transition = "opacity .2s ease, transform .2s ease";
    node.style.opacity = "0";
    node.style.transform = "translateY(6px)";
    setTimeout(() => node.remove(), 220);
  }, ms);
}

/* ── 바텀시트 ──────────────────────────────────────────── */
const sheetEl = () => document.getElementById("sheet");
let lastFocus = null;

export function openSheet(title, bodyNode) {
  const s = sheetEl();
  lastFocus = document.activeElement;
  document.getElementById("sheetTitle").textContent = title;
  const body = document.getElementById("sheetBody");
  body.textContent = "";
  body.append(bodyNode);
  s.classList.add("is-open");
  document.body.style.overflow = "hidden";
  const first = body.querySelector("input, textarea, button");
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
}

export function closeSheet() {
  const s = sheetEl();
  s.classList.remove("is-open");
  document.body.style.overflow = "";
  document.getElementById("sheetBody").textContent = "";
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

export function initSheet() {
  const s = sheetEl();
  s.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && s.classList.contains("is-open")) closeSheet();
  });
}

/** confirm() 대체 — Promise<boolean> */
export function askConfirm({ title, message, okLabel = "확인", danger = false }) {
  return new Promise((resolve) => {
    const body = el("div", {},
      el("p", { text: message, style: "color:var(--ink-2);font-size:14.5px" }),
      el("div", { class: "sheet__actions" },
        el("button", {
          class: "btn btn--ghost", type: "button", text: "취소",
          onclick: () => { closeSheet(); resolve(false); },
        }),
        el("button", {
          class: "btn " + (danger ? "btn--danger" : "btn--primary"),
          type: "button", text: okLabel,
          onclick: () => { closeSheet(); resolve(true); },
        })));
    openSheet(title, body);
  });
}

/** 액션 목록 시트 */
export function openActions(title, actions) {
  const list = el("ul", { class: "sheet__list" });
  for (const a of actions) {
    list.append(el("li", {}, el("button", {
      class: a.danger ? "is-danger" : "",
      type: "button",
      onclick: () => { closeSheet(); a.run(); },
    }, el("span", { "aria-hidden": "true", text: a.icon || "" }), a.label)));
  }
  openSheet(title, list);
}

/* ── 테마 ──────────────────────────────────────────────── */
const THEME_KEY = "snow.theme";

export function initTheme() {
  const saved = safeGet(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
  paintThemeIcon();
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme")
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  safeSet(THEME_KEY, next);
  paintThemeIcon();
}

function paintThemeIcon() {
  const root = document.documentElement;
  const dark = root.getAttribute("data-theme") === "dark"
    || (!root.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  document.getElementById("themeIcon").textContent = dark ? "☀" : "☾";
}

export function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* 사파리 비공개 모드 */ } }

/* ── 당겨서 새로고침 ───────────────────────────────────── */
export function initPullToRefresh(onRefresh) {
  const ind = document.getElementById("ptr");
  const THRESHOLD = 76;
  let startY = 0, pulling = false, dist = 0;

  addEventListener("touchstart", (e) => {
    if (window.scrollY > 0 || document.getElementById("sheet").classList.contains("is-open")) return;
    startY = e.touches[0].clientY;
    pulling = true;
    dist = 0;
  }, { passive: true });

  addEventListener("touchmove", (e) => {
    if (!pulling) return;
    dist = e.touches[0].clientY - startY;
    if (dist <= 0) { reset(); return; }
    const shift = Math.min(dist * 0.5, 78);
    ind.classList.add("is-visible");
    ind.style.transform = `translate(-50%, ${shift - 46}px) rotate(${dist * 2}deg)`;
  }, { passive: true });

  addEventListener("touchend", async () => {
    if (!pulling) return;
    if (dist > THRESHOLD) {
      ind.classList.add("is-spinning");
      ind.style.transform = "translate(-50%, 20px)";
      try { await onRefresh(); } finally {
        ind.classList.remove("is-spinning");
        reset();
      }
    } else reset();
    pulling = false;
  });

  function reset() {
    pulling = false;
    ind.classList.remove("is-visible", "is-spinning");
    ind.style.transform = "translate(-50%, -60px)";
  }
}
