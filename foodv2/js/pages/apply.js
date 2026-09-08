/* =========================================================
   pages/apply.js — 교사 급식 신청 화면

   v1(meal.html) 대비 변경점
   - 상태를 DOM(체크박스/텍스트)이 아니라 state 객체 한 곳에서 관리
   - 반응형을 CSS 로 처리 → 리사이즈 시 재렌더/선택 유실 없음
   - 오래된 비동기 응답이 최신 화면을 덮지 않도록 렌더 토큰 사용
   - alert/confirm 대신 <dialog> · 토스트
   - ✨ 신규: 신청하지 않은 날짜에 "미신청 사유" 입력
   ========================================================= */

import { MONTH_STATUS, MONTH_STATUS_LABEL, REASON_PRESETS } from "../config.js";
import { requireAccess } from "../auth/guard.js";
import {
  el, icon, render, toast, confirmDialog, reasonDialog,
  initTheme, createRenderToken, skeletonRows,
} from "../util/dom.js";
import { buildHeader, sectionHead } from "../ui/shell.js";
import {
  DOW_LABEL, buildMonthGrid, dowOf, getSchoolDays, isWeekend, formatDateTime,
} from "../util/date.js";
import { getTeacherYear, getMonthStatuses, getBlocked } from "../repo/settings.js";
import { getMyRequest, saveMyRequest } from "../repo/requests.js";

initTheme();

/* =========================================================
   상태
   ========================================================= */

const state = {
  access: null,
  year: new Date().getFullYear(),
  statuses: {},
  month: null,
  status: MONTH_STATUS.CLOSED,
  blocked: [],
  notes: {},
  schoolDays: [],
  selected: new Set(),
  reasons: new Map(),
  original: { days: [], reasons: {} },
  hasExisting: false,
  savedAt: null,
  dirty: false,
  loading: false,
};

const monthToken = createRenderToken();
const cellMap = new Map();
const refs = {};

/* =========================================================
   부팅
   ========================================================= */

(async function boot() {
  const access = await requireAccess();
  state.access = access;

  document.getElementById("headerSlot").appendChild(
    buildHeader({
      title: `${access.name} 선생님`,
      subtitle: access.email,
      user: access,
      showAdminLink: true,
    }),
  );

  if (new URLSearchParams(location.search).get("error") === "forbidden") {
    toast("관리자 권한이 필요한 페이지입니다.", "warn");
    history.replaceState(null, "", location.pathname);
  }

  buildLayout();

  try {
    state.year = await getTeacherYear();
    refs.yearLabel.textContent = `${state.year}년`;
    state.statuses = await getMonthStatuses(state.year);
    renderMonthPicker();
    autoSelectMonth();
  } catch (e) {
    console.error("[apply] 초기 로딩 실패:", e);
    render(refs.monthPickerSlot,
      el("div", { class: "banner banner--danger" },
        el("span", { class: "banner__icon" }, icon("alert", 16)),
        el("div", { class: "banner__body" },
          el("div", { class: "banner__title" }, "설정을 불러오지 못했습니다"),
          el("div", { class: "banner__desc" }, "네트워크 상태를 확인한 뒤 새로고침해 주세요."),
        ),
      ),
    );
  }
})();

/* =========================================================
   레이아웃
   ========================================================= */

function buildLayout() {
  refs.yearLabel = el("span", { class: "badge badge--accent" }, `${state.year}년`);
  refs.monthPickerSlot = el("div", null, ...skeletonRows(1, "skeleton--row"));

  const monthCard = el("section", { class: "card" },
    sectionHead(null, "신청할 달을 선택하세요",
      "회색은 아직 열리지 않은 달, 주황색은 마감되어 조회만 가능한 달입니다.",
      refs.yearLabel),
    refs.monthPickerSlot,
  );

  refs.applySlot = el("section", { id: "applyArea" });

  render(document.getElementById("pageSlot"),
    el("div", { class: "stack-6" }, monthCard, refs.applySlot),
  );

  render(refs.applySlot, emptyMonthNotice());

  // 저장하지 않은 변경사항 보호
  window.addEventListener("beforeunload", (e) => {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

function emptyMonthNotice() {
  return el("div", { class: "card" },
    el("div", { class: "empty" },
      el("div", { class: "empty__icon" }, icon("calendar", 26)),
      el("div", { class: "empty__title" }, "위에서 달을 선택해 주세요"),
      el("div", { class: "empty__desc" }, "선택한 달의 급식 신청 달력이 표시됩니다."),
    ),
  );
}

/* =========================================================
   월 선택
   ========================================================= */

function renderMonthPicker() {
  const picker = el("div", { class: "month-picker", role: "group", "aria-label": "월 선택" });

  for (let m = 1; m <= 12; m++) {
    const status = state.statuses[m] ?? MONTH_STATUS.CLOSED;
    const selectable = status === MONTH_STATUS.OPEN || status === MONTH_STATUS.READONLY;

    const btn = el("button", {
      class: "month-picker__btn",
      type: "button",
      disabled: !selectable,
      "aria-pressed": String(state.month === m),
      "aria-label": `${m}월 ${MONTH_STATUS_LABEL[status]}`,
      title: `${m}월 · ${MONTH_STATUS_LABEL[status]}`,
      dataset: { status: String(status), month: String(m) },
      onClick: () => selectMonth(m),
    },
      el("span", null, `${m}월`),
      el("span", { class: "month-picker__dot" }),
    );

    picker.appendChild(btn);
  }

  render(refs.monthPickerSlot, picker);
  refs.picker = picker;
}

function syncPickerSelection() {
  if (!refs.picker) return;
  for (const btn of refs.picker.children) {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.month) === state.month));
  }
}

/** 이번 달이 열려 있으면 자동 선택, 아니면 열린 첫 달 */
function autoSelectMonth() {
  const thisMonth = new Date().getMonth() + 1;
  const openable = (m) => {
    const s = state.statuses[m];
    return s === MONTH_STATUS.OPEN || s === MONTH_STATUS.READONLY;
  };

  if (openable(thisMonth)) return selectMonth(thisMonth);

  const first = Object.keys(state.statuses)
    .map(Number)
    .sort((a, b) => a - b)
    .find((m) => state.statuses[m] === MONTH_STATUS.OPEN);

  if (first) selectMonth(first);
}

async function selectMonth(month) {
  if (state.dirty) {
    const answer = await confirmDialog({
      title: "저장하지 않은 변경사항이 있습니다",
      message: "다른 달로 이동하면 지금까지 고친 내용이 사라집니다.",
      confirmText: "이동",
      cancelText: "머무르기",
      tone: "danger",
    });
    if (answer !== "confirm") return;
  }

  const token = monthToken.next();
  state.month = month;
  state.status = state.statuses[month] ?? MONTH_STATUS.CLOSED;
  state.dirty = false;
  syncPickerSelection();

  render(refs.applySlot,
    el("div", { class: "card stack" }, ...skeletonRows(5, "skeleton--row")),
  );

  try {
    const [blockedDoc, myRequest] = await Promise.all([
      getBlocked(state.year, month),
      getMyRequest(state.access.user, state.year, month),
    ]);

    // 뒤늦게 도착한 이전 요청이 현재 화면을 덮어쓰지 않도록
    if (monthToken.isStale(token)) return;

    state.blocked = blockedDoc.days;
    state.notes = blockedDoc.notes;
    state.schoolDays = getSchoolDays(state.year, month, state.blocked);

    state.hasExisting = Boolean(myRequest);
    state.savedAt = myRequest?.updatedAt ?? null;
    state.selected = new Set(myRequest?.days ?? []);
    state.reasons = new Map(
      Object.entries(myRequest?.reasons ?? {}).map(([k, v]) => [Number(k), v]),
    );
    state.original = snapshot();

    renderApplyArea();
  } catch (e) {
    console.error("[apply] 달력 로딩 실패:", e);
    if (monthToken.isStale(token)) return;
    render(refs.applySlot,
      el("div", { class: "card" },
        el("div", { class: "banner banner--danger" },
          el("span", { class: "banner__icon" }, icon("alert", 16)),
          el("div", { class: "banner__body" },
            el("div", { class: "banner__title" }, `${month}월 정보를 불러오지 못했습니다`),
            el("div", { class: "banner__desc" }, "잠시 후 달을 다시 선택해 주세요."),
          ),
        ),
      ),
    );
  }
}

/* =========================================================
   신청 영역 렌더
   ========================================================= */

function renderApplyArea() {
  cellMap.clear();

  const isOpen = state.status === MONTH_STATUS.OPEN;

  refs.banner = el("div");
  refs.summary = el("div", { class: "row row--tight" });
  refs.calendar = el("div", { class: "cal" });

  const toolbar = isOpen
    ? el("div", { class: "row row--tight" },
        el("button", { class: "btn btn--sm", type: "button", onClick: () => setAll(true) },
          icon("check", 14), "전체 신청"),
        el("button", { class: "btn btn--sm", type: "button", onClick: () => setAll(false) },
          icon("x", 14), "전체 해제"),
        el("button", { class: "btn btn--sm btn--soft", type: "button", onClick: bulkFillReasons },
          icon("pencil", 14), "미입력 사유 한 번에 채우기"),
      )
    : null;

  refs.saveBtn = el("button", {
    class: "btn btn--primary", type: "button", onClick: handleSave,
  }, icon("save", 15), state.hasExisting ? "변경사항 저장" : "신청하기");

  refs.savebarInfo = el("span", { class: "savebar__info" });

  const savebar = isOpen
    ? el("div", { class: "savebar" },
        refs.savebarInfo,
        el("div", { class: "savebar__actions" },
          el("button", { class: "btn", type: "button", onClick: resetChanges }, "되돌리기"),
          refs.saveBtn,
        ),
      )
    : null;

  const card = el("section", { class: "card stack" },
    sectionHead(null, `${state.year}년 ${state.month}월 급식 신청`,
      isOpen
        ? "날짜를 눌러 신청/미신청을 전환하고, 신청하지 않는 날은 사유를 남겨 주세요."
        : "마감된 달입니다. 신청 내역을 확인만 할 수 있습니다."),
    refs.banner,
    refs.summary,
    buildLegend(),
    toolbar,
    refs.calendar,
    savebar,
  );

  render(refs.applySlot, card);

  renderCalendar();
  paintBanner();
  paintSummary();
}

function buildLegend() {
  const item = (cls, label) => el("span", { class: "legend__item" },
    el("i", { class: `legend__swatch legend__swatch--${cls}` }), label);

  return el("div", { class: "legend" },
    item("applied", "신청"),
    item("skipped", "미신청"),
    item("reason", "사유 입력됨"),
    item("blocked", "급식 미실시"),
    item("weekend", "주말"),
  );
}

function renderCalendar() {
  const grid = el("div", { class: "cal" });

  for (let i = 0; i < 7; i++) {
    grid.appendChild(
      el("div", { class: "cal__dowhead", dataset: { dow: String(i) } }, DOW_LABEL[i]),
    );
  }

  const { padCount, days } = buildMonthGrid(state.year, state.month);
  for (let i = 0; i < padCount; i++) {
    grid.appendChild(el("div", { class: "cal__cell cal__cell--pad", "aria-hidden": "true" }));
  }

  for (const day of days) {
    const cell = buildCell(day);
    cellMap.set(day, cell);
    grid.appendChild(cell);
  }

  refs.calendar.replaceWith(grid);
  refs.calendar = grid;
}

function buildCell(day) {
  const dow = dowOf(state.year, state.month, day);
  const blocked = state.blocked.includes(day);

  const head = el("div", { class: "cal__cellhead" },
    el("span", { class: "cal__date" }, String(day)),
    el("span", { class: "cal__dow" }, `(${DOW_LABEL[dow]})`),
    blocked
      ? el("span", { class: "badge badge--danger cal__note", title: state.notes[String(day)] || "급식 미실시" },
          state.notes[String(day)] || "급식 미실시")
      : null,
  );

  const body = el("div", { class: "cal__body" });

  const cell = el("div", {
    class: "cal__cell",
    dataset: { dow: String(dow), day: String(day) },
  }, head, body);

  cell._body = body;
  paintCell(day, cell);
  return cell;
}

function paintCell(day, cellArg = null) {
  const cell = cellArg || cellMap.get(day);
  if (!cell) return;

  const body = cell._body;
  const blocked = state.blocked.includes(day);
  const weekend = isWeekend(state.year, state.month, day);
  const isOpen = state.status === MONTH_STATUS.OPEN;

  cell.className = "cal__cell";
  body.replaceChildren();

  /* 주말 · 미실시일 — 조작 불가 */
  if (weekend || blocked) {
    cell.classList.add(weekend ? "cal__cell--weekend" : "cal__cell--blocked");
    if (blocked) {
      body.appendChild(el("div", { class: "cal__readonly" }, icon("x", 13), "급식 없음"));
    }
    return;
  }

  const applied = state.selected.has(day);
  const reason = state.reasons.get(day) || "";

  if (applied) cell.classList.add("cal__cell--applied");
  else if (reason) cell.classList.add("cal__cell--has-reason");

  if (isOpen) cell.classList.add("cal__cell--interactive");

  /* 신청 토글 */
  const toggle = el("button", {
    class: "cal__toggle",
    type: "button",
    disabled: !isOpen,
    "aria-pressed": String(applied),
    "aria-label": `${state.month}월 ${day}일 ${applied ? "신청 취소" : "급식 신청"}`,
    onClick: () => toggleDay(day),
  },
    applied ? icon("check", 13) : null,
    applied ? "신청" : "미신청",
  );
  body.appendChild(toggle);

  /* 미신청 사유 */
  if (!applied) {
    if (isOpen) {
      const filled = Boolean(reason);
      body.appendChild(
        el("button", {
          class: `cal__reason ${filled ? "cal__reason--filled" : "cal__reason--missing"}`,
          type: "button",
          title: filled ? `사유: ${reason}` : "미신청 사유를 입력하세요",
          "aria-label": `${day}일 미신청 사유 ${filled ? `: ${reason}` : "입력"}`,
          onClick: (e) => { e.stopPropagation(); editReason(day); },
        },
          el("span", { class: "cal__reason__icon" }, icon(filled ? "pencil" : "alert", 11)),
          el("span", { class: "cal__reason__text" }, filled ? reason : "사유 입력"),
        ),
      );
    } else if (reason) {
      body.appendChild(
        el("div", { class: "cal__reason cal__reason--filled", title: reason },
          el("span", { class: "cal__reason__icon" }, icon("info", 11)),
          el("span", { class: "cal__reason__text" }, reason),
        ),
      );
    }
  }
}

/* =========================================================
   배너 · 요약
   ========================================================= */

function paintBanner() {
  if (state.status === MONTH_STATUS.READONLY) {
    render(refs.banner,
      el("div", { class: "banner banner--warn" },
        el("span", { class: "banner__icon" }, icon("lock", 16)),
        el("div", { class: "banner__body" },
          el("div", { class: "banner__title" }, "조회 전용 · 신청이 마감되었습니다"),
          el("div", { class: "banner__desc" },
            "수정이 필요하면 박희수 선생님에게 문의해 주세요."),
        ),
      ),
    );
    return;
  }

  if (state.hasExisting) {
    render(refs.banner,
      el("div", { class: "banner banner--accent" },
        el("span", { class: "banner__icon" }, icon("refresh", 16)),
        el("div", { class: "banner__body" },
          el("div", { class: "banner__title" }, "수정 모드 · 이미 저장된 내역이 있습니다"),
          el("div", { class: "banner__desc" },
            state.savedAt ? `최종 저장 ${formatDateTime(state.savedAt)}` : "변경 후 저장하기를 눌러 주세요."),
        ),
      ),
    );
    return;
  }

  render(refs.banner,
    el("div", { class: "banner banner--ok" },
      el("span", { class: "banner__icon" }, icon("check", 16)),
      el("div", { class: "banner__body" },
        el("div", { class: "banner__title" }, "신청 모드"),
        el("div", { class: "banner__desc" },
          "급식을 먹는 날을 선택하고, 먹지 않는 날에는 사유를 입력해 주세요."),
      ),
    ),
  );
}

function paintSummary() {
  const applied = state.schoolDays.filter((d) => state.selected.has(d)).length;
  const skipped = state.schoolDays.length - applied;
  const missing = countMissingReasons();

  render(refs.summary,
    el("span", { class: "badge badge--accent" },
      el("i", { class: "badge__dot" }), `신청 ${applied}일`),
    el("span", { class: "badge" }, `미신청 ${skipped}일`),
    missing > 0
      ? el("span", { class: "badge badge--danger" },
          el("i", { class: "badge__dot" }), `사유 미입력 ${missing}일`)
      : (skipped > 0
          ? el("span", { class: "badge badge--ok" }, el("i", { class: "badge__dot" }), "사유 입력 완료")
          : null),
    el("span", { class: "badge" }, `급식 실시 ${state.schoolDays.length}일`),
  );

  if (refs.savebarInfo) {
    refs.savebarInfo.textContent = state.dirty
      ? "저장하지 않은 변경사항이 있습니다."
      : (state.hasExisting ? "저장된 내용과 동일합니다." : "아직 신청하지 않았습니다.");
  }
  if (refs.saveBtn) {
    refs.saveBtn.replaceChildren(icon("save", 15), state.hasExisting ? "변경사항 저장" : "신청하기");
  }
}

function countMissingReasons() {
  return state.schoolDays.filter(
    (d) => !state.selected.has(d) && !(state.reasons.get(d) || "").trim(),
  ).length;
}

/* =========================================================
   조작
   ========================================================= */

function toggleDay(day) {
  if (state.status !== MONTH_STATUS.OPEN) return;
  if (state.selected.has(day)) state.selected.delete(day);
  else state.selected.add(day);

  paintCell(day);
  refreshDirty();
}

function setAll(applied) {
  if (state.status !== MONTH_STATUS.OPEN) return;
  for (const day of state.schoolDays) {
    if (applied) state.selected.add(day);
    else state.selected.delete(day);
    paintCell(day);
  }
  refreshDirty();
}

async function editReason(day) {
  const current = state.reasons.get(day) || "";
  const value = await reasonDialog({
    title: `${state.month}월 ${day}일 미신청 사유`,
    desc: "이 날 급식을 신청하지 않는 이유를 남겨 주세요. 관리자 집계 화면에 표시됩니다.",
    value: current,
    presets: REASON_PRESETS,
    allowClear: Boolean(current),
  });

  if (value === null) return;

  if (value === "") state.reasons.delete(day);
  else state.reasons.set(day, value);

  paintCell(day);
  refreshDirty();
}

async function bulkFillReasons() {
  const targets = state.schoolDays.filter(
    (d) => !state.selected.has(d) && !(state.reasons.get(d) || "").trim(),
  );

  if (!targets.length) {
    toast("사유가 비어 있는 미신청일이 없습니다.", "info");
    return;
  }

  const value = await reasonDialog({
    title: "미입력 사유 일괄 입력",
    desc: `사유가 비어 있는 ${targets.length}일(${targets.join(", ")}일)에 같은 사유를 넣습니다.`,
    presets: REASON_PRESETS,
    confirmText: "일괄 적용",
  });

  if (!value) return;

  for (const day of targets) {
    state.reasons.set(day, value);
    paintCell(day);
  }
  refreshDirty();
  toast(`${targets.length}일에 사유를 입력했습니다.`, "ok");
}

function resetChanges() {
  state.selected = new Set(state.original.days);
  state.reasons = new Map(
    Object.entries(state.original.reasons).map(([k, v]) => [Number(k), v]),
  );
  for (const day of state.schoolDays) paintCell(day);
  refreshDirty();
  toast("마지막 저장 상태로 되돌렸습니다.", "info");
}

/* =========================================================
   변경 감지 · 저장
   ========================================================= */

function snapshot() {
  const days = [...state.selected].filter((d) => state.schoolDays.includes(d)).sort((a, b) => a - b);
  const applied = new Set(days);
  const reasons = {};
  for (const day of state.schoolDays) {
    if (applied.has(day)) continue;
    const text = (state.reasons.get(day) || "").trim();
    if (text) reasons[String(day)] = text;
  }
  return { days, reasons };
}

function isSameAsOriginal(current) {
  const a = state.original;
  if (a.days.length !== current.days.length) return false;
  if (!a.days.every((v, i) => v === current.days[i])) return false;

  const keysA = Object.keys(a.reasons).sort();
  const keysB = Object.keys(current.reasons).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i] && a.reasons[k] === current.reasons[k]);
}

function refreshDirty() {
  state.dirty = !isSameAsOriginal(snapshot());
  paintSummary();
}

async function handleSave() {
  if (state.status !== MONTH_STATUS.OPEN) {
    toast("현재는 신청/수정 기간이 아닙니다.", "warn");
    return;
  }

  const current = snapshot();

  if (state.hasExisting && isSameAsOriginal(current)) {
    toast("변경된 내용이 없습니다.", "info");
    return;
  }

  /* 미신청 사유가 비어 있는 날 확인 */
  const missing = state.schoolDays.filter(
    (d) => !state.selected.has(d) && !(state.reasons.get(d) || "").trim(),
  );

  if (missing.length) {
    const answer = await confirmDialog({
      title: "미신청 사유가 비어 있습니다",
      message: `${missing.length}일의 사유가 입력되지 않았습니다. 사유 없이 저장할까요?`,
      listItems: missing.map((d) => `${state.month}월 ${d}일 (${DOW_LABEL[dowOf(state.year, state.month, d)]})`),
      confirmText: "사유 없이 저장",
      extraText: "사유 입력하기",
      cancelText: "취소",
    });

    if (answer === "cancel") return;
    if (answer === "extra") {
      const first = missing[0];
      cellMap.get(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      await editReason(first);
      return;
    }
  }

  if (current.days.length === 0) {
    const answer = await confirmDialog({
      title: state.hasExisting ? "신청 내역을 모두 취소합니다" : "이번 달 급식을 신청하지 않습니다",
      message: "선택된 날짜가 하나도 없습니다. 이대로 저장할까요?",
      confirmText: "저장",
      tone: "danger",
    });
    if (answer !== "confirm") return;
  }

  const btn = refs.saveBtn;
  const originalChildren = [...btn.childNodes];
  btn.disabled = true;
  btn.replaceChildren(el("span", { class: "btn__spinner" }), "저장 중…");

  try {
    await saveMyRequest(state.access.user, state.year, state.month, {
      days: current.days,
      reasons: current.reasons,
    });

    state.original = current;
    state.hasExisting = true;
    state.savedAt = new Date();
    state.dirty = false;

    paintBanner();
    paintSummary();
    toast("저장되었습니다.", "ok");
  } catch (e) {
    console.error("[apply] 저장 실패:", e);
    toast(`저장에 실패했습니다. ${e?.message || "다시 시도해 주세요."}`, "danger", 4200);
  } finally {
    btn.disabled = false;
    btn.replaceChildren(...originalChildren);
    paintSummary();
  }
}
