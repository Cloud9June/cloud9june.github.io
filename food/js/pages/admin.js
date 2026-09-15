/* =========================================================
   pages/admin.js — 관리자 셸

   v1(admin.html) 은 iframe 5개로 화면을 갈아끼웠습니다. 탭을 누를 때마다
   Firebase SDK 를 새로 로드하고 인증 게이트를 다시 통과해야 했고,
   iframe 의 src 가 HTML 에 하드코딩되어 있어 게이트가 무력화되기도 했습니다.
   v2 는 하나의 페이지에서 뷰 모듈만 갈아끼웁니다.
   ========================================================= */

import { requireAccess } from "../auth/guard.js";
import { el, render, icon, initTheme, toast } from "../util/dom.js";
import { buildHeader } from "../ui/shell.js";
import { ROUTES } from "../config.js";

initTheme();

const TABS = [
  { id: "settings", label: "월 · 미실시일 설정", iconName: "settings", load: () => import("./admin/settings-view.js") },
  { id: "teachers", label: "교사 신청 현황", iconName: "users", load: () => import("./admin/teachers-view.js") },
  { id: "students", label: "학생 급식 인원", iconName: "clipboard", load: () => import("./admin/students-view.js") },
  { id: "totals", label: "총원 집계", iconName: "chart", load: () => import("./admin/totals-view.js") },
];

const viewSlot = document.getElementById("viewSlot");
const tabsSlot = document.getElementById("tabsSlot");

let ctx = null;
let currentTab = null;
const tabButtons = new Map();

(async function boot() {
  const access = await requireAccess({ requireAdmin: true });
  ctx = { access };

  document.getElementById("headerSlot").appendChild(
    buildHeader({
      title: "급식 관리자",
      subtitle: access.email,
      user: access,
      extraActions: [
        el("a", { class: "btn btn--sm", href: ROUTES.APPLY }, icon("utensils", 14), "신청 화면"),
      ],
    }),
  );

  buildTabs();

  window.addEventListener("hashchange", () => activate(tabIdFromHash()));
  activate(tabIdFromHash());
})();

function tabIdFromHash() {
  const id = location.hash.replace("#", "");
  return TABS.some((t) => t.id === id) ? id : TABS[0].id;
}

function buildTabs() {
  const nav = el("div", { class: "tabs" });

  for (const tab of TABS) {
    const btn = el("button", {
      class: "tab",
      type: "button",
      role: "tab",
      "aria-selected": "false",
      onClick: () => { location.hash = tab.id; },
    }, tab.label);

    tabButtons.set(tab.id, btn);
    nav.appendChild(btn);
  }

  render(tabsSlot, nav);
}

async function activate(tabId) {
  if (currentTab === tabId) return;
  currentTab = tabId;

  for (const [id, btn] of tabButtons) {
    btn.setAttribute("aria-selected", String(id === tabId));
  }

  const tab = TABS.find((t) => t.id === tabId);
  render(viewSlot,
    el("div", { class: "empty", style: { minHeight: "30vh", justifyContent: "center" } },
      el("div", { class: "loading-line" }, `${tab.label} 불러오는 중…`)),
  );

  try {
    const module = await tab.load();
    if (currentTab !== tabId) return;   // 그 사이 다른 탭으로 이동했으면 폐기
    render(viewSlot);
    await module.mount(viewSlot, ctx);
  } catch (e) {
    console.error(`[admin] ${tabId} 뷰 로딩 실패:`, e);
    toast("화면을 불러오지 못했습니다.", "danger");
    render(viewSlot,
      el("div", { class: "card" },
        el("div", { class: "banner banner--danger" },
          el("span", { class: "banner__icon" }, icon("alert", 16)),
          el("div", { class: "banner__body" },
            el("div", { class: "banner__title" }, "화면을 불러오지 못했습니다"),
            el("div", { class: "banner__desc" }, e?.message || "새로고침 후 다시 시도해 주세요."),
          ),
        ),
      ),
    );
  }
}
