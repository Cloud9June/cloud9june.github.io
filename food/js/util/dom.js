/* =========================================================
   util/dom.js — DOM 생성 · 아이콘 · 토스트 · 다이얼로그

   원칙
   - innerHTML 대신 el() 로 노드를 만들어 XSS 경로를 원천 차단합니다.
     (v1 은 교사 표시이름/사유를 innerHTML 로 넣어 스크립트 삽입이 가능했습니다)
   - alert/confirm/prompt 대신 <dialog> 기반 컴포넌트를 씁니다.
   ========================================================= */

/* ---------------------------------------------------------
   엘리먼트 생성
   --------------------------------------------------------- */

/**
 * el("button", { class:"btn", onClick: fn }, "저장")
 * - 이벤트: onClick / onChange / onInput …
 * - dataset: { day: 3 }
 * - 자식: 문자열(자동 이스케이프) · 노드 · 배열 · null(무시)
 */
export function el(tag, props = null, ...children) {
  const node = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "text") node.textContent = value;
      else if (key in node && key !== "list" && key !== "form") node[key] = value;
      else node.setAttribute(key, value === true ? "" : value);
    }
  }

  appendChildren(node, children);
  return node;
}

export function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === "") continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** 컨테이너를 비우고 새 내용으로 교체 */
export function render(container, ...children) {
  container.replaceChildren();
  appendChildren(container, children);
  return container;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 신뢰할 수 없는 문자열을 HTML 문자열에 넣어야 할 때만 사용 */
export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/* ---------------------------------------------------------
   아이콘 (lucide 스타일 인라인 SVG · 외부 의존성 없음)
   --------------------------------------------------------- */

const ICON_PATHS = {
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M5 12h14M12 5v14",
  minus: "M5 12h14",
  pencil: "M21.17 3.83a2.83 2.83 0 0 0-4 0L4 16.99 3 21l4.01-1L20.17 6.83a2.83 2.83 0 0 0 0-3z",
  alert: "M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  info: "M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  chart: "M18 20V10M12 20V4M6 20v-6",
  clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
  utensils: "M3 2v7a3 3 0 0 0 3 3v10M6 2v7M9 2v7M17 2c-1.66 0-3 3-3 7 0 2 .5 3 2 3.5V22",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
};

/**
 * icon("check", 16) → <svg>
 */
export function icon(name, size = 15, extraClass = "") {
  const path = ICON_PATHS[name];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.style.flex = "none";
  if (extraClass) svg.setAttribute("class", extraClass);

  if (path) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
  }
  return svg;
}

/* ---------------------------------------------------------
   토스트
   --------------------------------------------------------- */

let toastHost = null;

function ensureToastHost() {
  if (!toastHost) {
    toastHost = el("div", { class: "toast-host", role: "status", "aria-live": "polite" });
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

/**
 * toast("저장되었습니다", "ok")
 * @param {"ok"|"warn"|"danger"|"info"} type
 */
export function toast(message, type = "info", duration = 2800) {
  const host = ensureToastHost();
  const iconName = { ok: "check", warn: "alert", danger: "alert", info: "info" }[type] || "info";

  const node = el("div", { class: `toast toast--${type}` },
    el("span", { class: "toast__icon" }, icon(iconName, 17)),
    el("span", { class: "toast__msg" }, message),
  );

  host.appendChild(node);

  const remove = () => {
    node.classList.add("toast--out");
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  const timer = setTimeout(remove, duration);
  node.addEventListener("click", () => { clearTimeout(timer); remove(); });
  return remove;
}

/* ---------------------------------------------------------
   다이얼로그
   --------------------------------------------------------- */

function openDialog(dialog) {
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
  return dialog;
}

/**
 * 확인 다이얼로그. window.confirm 대체.
 * @returns {Promise<"confirm"|"cancel"|"extra">}
 */
export function confirmDialog({
  title,
  message = "",
  listItems = null,
  confirmText = "확인",
  cancelText = "취소",
  extraText = null,
  tone = "primary", // primary | danger
} = {}) {
  return new Promise((resolve) => {
    let result = "cancel";

    const dialog = el("dialog", { class: "dialog" },
      el("div", { class: "dialog__head" },
        el("div", { class: "dialog__title" }, title),
        message ? el("div", { class: "dialog__desc" }, message) : null,
      ),
      listItems && listItems.length
        ? el("div", { class: "dialog__body" },
            el("div", { class: "dialog__list" }, ...listItems.map((t) => el("div", null, t))))
        : null,
      el("div", { class: "dialog__foot" },
        el("button", {
          class: "btn", type: "button",
          onClick: () => { result = "cancel"; dialog.close(); },
        }, cancelText),
        extraText
          ? el("button", {
              class: "btn btn--soft", type: "button",
              onClick: () => { result = "extra"; dialog.close(); },
            }, extraText)
          : null,
        el("button", {
          class: `btn ${tone === "danger" ? "btn--danger" : "btn--primary"}`, type: "button",
          onClick: () => { result = "confirm"; dialog.close(); },
        }, confirmText),
      ),
    );

    dialog.addEventListener("close", () => resolve(result), { once: true });
    openDialog(dialog);
    dialog.querySelector(".btn--primary, .btn--danger")?.focus();
  });
}

/**
 * 사유 입력 다이얼로그 (프리셋 칩 + 자유 입력). window.prompt 대체.
 * @returns {Promise<string|null>} null = 취소
 */
export function reasonDialog({
  title = "미신청 사유",
  desc = "",
  value = "",
  presets = [],
  placeholder = "사유를 입력하세요",
  confirmText = "저장",
  allowClear = false,
} = {}) {
  return new Promise((resolve) => {
    let result = null;

    const input = el("input", {
      class: "input", type: "text", value, placeholder, maxLength: 60,
      onKeydown: (e) => {
        if (e.key === "Enter") { e.preventDefault(); result = input.value.trim(); dialog.close(); }
      },
    });

    const chips = presets.map((p) =>
      el("button", {
        class: "chip", type: "button",
        "aria-pressed": String(p === value),
        onClick: () => {
          input.value = p;
          chipGroup.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
          chipGroup.querySelectorAll(".chip").forEach((c) => {
            if (c.textContent === p) c.setAttribute("aria-pressed", "true");
          });
          input.focus();
        },
      }, p));

    const chipGroup = el("div", { class: "chip-group" }, ...chips);

    const dialog = el("dialog", { class: "dialog" },
      el("div", { class: "dialog__head" },
        el("div", { class: "dialog__title" }, title),
        desc ? el("div", { class: "dialog__desc" }, desc) : null,
      ),
      el("div", { class: "dialog__body stack" },
        presets.length ? chipGroup : null,
        input,
      ),
      el("div", { class: "dialog__foot" },
        el("button", { class: "btn", type: "button", onClick: () => { result = null; dialog.close(); } }, "취소"),
        allowClear
          ? el("button", {
              class: "btn btn--ghost", type: "button",
              onClick: () => { result = ""; dialog.close(); },
            }, "사유 지우기")
          : null,
        el("button", {
          class: "btn btn--primary", type: "button",
          onClick: () => { result = input.value.trim(); dialog.close(); },
        }, confirmText),
      ),
    );

    dialog.addEventListener("close", () => resolve(result), { once: true });
    openDialog(dialog);
    setTimeout(() => input.focus(), 30);
  });
}

/**
 * 숫자 입력 다이얼로그 (학생 인원 등)
 * @returns {Promise<number|null>}
 */
export function numberDialog({ title, desc = "", value = 0, min = 0, max = 9999 } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const input = el("input", {
      class: "input input--num", type: "number", value, min, max, inputMode: "numeric",
      onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); result = Number(input.value); dialog.close(); } },
    });

    const dialog = el("dialog", { class: "dialog" },
      el("div", { class: "dialog__head" },
        el("div", { class: "dialog__title" }, title),
        desc ? el("div", { class: "dialog__desc" }, desc) : null),
      el("div", { class: "dialog__body" }, input),
      el("div", { class: "dialog__foot" },
        el("button", { class: "btn", type: "button", onClick: () => { result = null; dialog.close(); } }, "취소"),
        el("button", {
          class: "btn btn--primary", type: "button",
          onClick: () => { result = Number(input.value); dialog.close(); },
        }, "적용"),
      ),
    );

    dialog.addEventListener("close", () => resolve(result), { once: true });
    openDialog(dialog);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

/* ---------------------------------------------------------
   상태 표시 헬퍼
   --------------------------------------------------------- */

export function skeletonRows(count = 4, className = "skeleton--row") {
  return Array.from({ length: count }, () => el("div", { class: `skeleton ${className}` }));
}

export function emptyState({ icon: iconName = "info", title = "내용이 없습니다", desc = "" } = {}) {
  return el("div", { class: "empty" },
    el("div", { class: "empty__icon" }, icon(iconName, 26)),
    el("div", { class: "empty__title" }, title),
    desc ? el("div", { class: "empty__desc" }, desc) : null,
  );
}

export function loadingLine(text = "불러오는 중…") {
  return el("div", { class: "loading-line" }, text);
}

/** 버튼을 로딩 상태로 잠갔다가 되돌리는 헬퍼 */
export async function withBusy(button, fn, busyText = null) {
  if (!button) return fn();
  const original = button.textContent;
  const spinner = el("span", { class: "btn__spinner" });
  button.disabled = true;
  button.replaceChildren(spinner, busyText || original);
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.replaceChildren(original);
  }
}

/* ---------------------------------------------------------
   테마 (라이트/다크 수동 전환)
   --------------------------------------------------------- */

const THEME_KEY = "meal-v2:theme";

export function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  } catch { /* 프라이빗 모드 등 — 시스템 설정을 그대로 사용 */ }
}

export function createThemeToggle() {
  const btn = el("button", {
    class: "btn btn--ghost btn--icon btn--sm",
    type: "button",
    title: "라이트/다크 전환",
    "aria-label": "라이트/다크 전환",
  });

  const paint = () => {
    const isDark = document.documentElement.dataset.theme === "dark"
      || (!document.documentElement.dataset.theme
          && window.matchMedia("(prefers-color-scheme: dark)").matches);
    btn.replaceChildren(icon(isDark ? "sun" : "moon", 16));
  };

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark"
      || (!document.documentElement.dataset.theme
          && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 저장 실패는 무시 */ }
    paint();
  });

  paint();
  return btn;
}

/* ---------------------------------------------------------
   기타
   --------------------------------------------------------- */

export function debounce(fn, ms = 400) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  wrapped.flush = (...args) => { clearTimeout(timer); fn(...args); };
  return wrapped;
}

/** 비동기 작업의 오래된 응답이 최신 화면을 덮어쓰지 않도록 하는 토큰 */
export function createRenderToken() {
  let current = 0;
  return {
    next: () => ++current,
    isStale: (token) => token !== current,
  };
}
