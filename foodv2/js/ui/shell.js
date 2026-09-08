/* =========================================================
   ui/shell.js — 공통 헤더 / 페이지 골격
   ========================================================= */

import { el, icon, createThemeToggle, confirmDialog } from "../util/dom.js";
import { logout } from "../auth/guard.js";
import { ROUTES } from "../config.js";

/**
 * 상단 헤더를 만들어 반환합니다.
 * @param {{
 *   title: string, subtitle?: string,
 *   user?: {name:string, email:string, isAdmin:boolean},
 *   showAdminLink?: boolean, showLogout?: boolean,
 *   extraActions?: Node[]
 * }} options
 */
export function buildHeader({
  title,
  subtitle = "",
  user = null,
  showAdminLink = false,
  showLogout = true,
  extraActions = [],
} = {}) {
  const actions = [...extraActions];

  if (showAdminLink && user?.isAdmin) {
    actions.push(
      el("a", { class: "btn btn--sm", href: ROUTES.ADMIN },
        icon("settings", 14), "관리자"),
    );
  }

  actions.push(createThemeToggle());

  if (showLogout && user) {
    actions.push(
      el("button", {
        class: "btn btn--ghost btn--icon btn--sm",
        type: "button",
        title: "로그아웃",
        "aria-label": "로그아웃",
        onClick: async () => {
          const answer = await confirmDialog({
            title: "로그아웃",
            message: "현재 계정에서 로그아웃합니다.",
            confirmText: "로그아웃",
            tone: "danger",
          });
          if (answer === "confirm") await logout();
        },
      }, icon("logout", 16)),
    );
  }

  return el("header", { class: "app-header" },
    el("div", { class: "app-header__inner" },
      el("div", { class: "brand" },
        el("div", { class: "brand__mark" }, icon("utensils", 16)),
        el("div", { class: "brand__text" },
          el("div", { class: "brand__title" }, title),
          subtitle ? el("div", { class: "brand__sub" }, subtitle) : null,
        ),
      ),
      el("div", { class: "app-header__actions" }, ...actions),
    ),
  );
}

/** 섹션 제목 블록 */
export function sectionHead(num, title, desc = "", trailing = null) {
  return el("div", { class: "section-head" },
    num ? el("div", { class: "section-head__num" }, String(num)) : null,
    el("div", { class: "section-head__body" },
      el("h2", null, title),
      desc ? el("div", { class: "section-head__desc" }, desc) : null,
    ),
    trailing ? el("div", { class: "spacer" }) : null,
    trailing,
  );
}

/** 앱 전체 로딩 화면 */
export function fullPageLoading(text = "권한을 확인하는 중…") {
  return el("div", {
    class: "empty",
    style: { minHeight: "60vh", justifyContent: "center" },
  },
    el("div", { class: "loading-line" }, text),
  );
}

/** 페이지 하단 표기 */
export function buildFooter(note = "") {
  return el("footer", { class: "app-footer" },
    note || "급식 관리 시스템",
  );
}
