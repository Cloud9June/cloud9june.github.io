/* =========================================================
   admin/students-view.js — 학생 급식 인원

   v1 대비 변경
   - 달력에서 편집하는 값이 "기준 인원(base)" 임을 명확히 하고,
     차감분은 읽기 전용 배지로 따로 보여 줍니다.
     (v1 은 화면값에 차감량을 되더해 저장해서, 결석표를 고친 뒤 +/- 를
      누르면 기준 인원이 조용히 틀어지는 문제가 있었습니다)
   - 상태를 DOM 텍스트에서 파싱하지 않고 state 에서 관리합니다.
   - +/- 연타 시 쓰기가 폭주하지 않도록 디바운스합니다.
   ========================================================= */

import { SAVE_DEBOUNCE_MS } from "../../config.js";
import {
  el, icon, render, toast, debounce, confirmDialog,
  createRenderToken, skeletonRows, emptyState,
} from "../../util/dom.js";
import { sectionHead } from "../../ui/shell.js";
import {
  DOW_LABEL, buildMonthGrid, dowOf, isWeekend, yearOptions, toCount, isoDate,
} from "../../util/date.js";
import {
  loadStudentMonth, fillMonth, saveStudentDay, saveAbsences, mirrorEffective, computeDeductions,
} from "../../repo/students.js";

const token = createRenderToken();

export async function mount(container, ctx) {
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    base: {},
    blocked: [],
    notes: {},
    absences: [],
    deduct: {},
    schoolDays: [],
    bulkMonths: new Set(),
  };

  const refs = {};

  container.appendChild(
    el("div", { class: "stack-8" },
      buildBulkCard(state, refs),
      buildCalendarCard(state, refs),
      buildAbsenceCard(state, refs),
    ),
  );

  await load(state, refs);
}

/* =========================================================
   1. 일괄 등록
   ========================================================= */

function buildBulkCard(state, refs) {
  const yearSel = el("select", {
    class: "select select--sm", style: { width: "110px" },
    onChange: () => { state.year = Number(yearSel.value); load(state, refs); },
  }, ...yearOptions().map((y) => el("option", { value: String(y), selected: y === state.year }, `${y}년`)));

  const monthSel = el("select", {
    class: "select select--sm", style: { width: "95px" },
    onChange: () => { state.month = Number(monthSel.value); load(state, refs); },
  }, ...Array.from({ length: 12 }, (_, i) =>
    el("option", { value: String(i + 1), selected: i + 1 === state.month }, `${i + 1}월`)));

  refs.countInput = el("input", {
    class: "input input--sm input--num", type: "number", min: "0", max: "9999",
    placeholder: "예: 320", style: { width: "120px" }, inputMode: "numeric",
  });

  const monthChips = el("div", { class: "chip-group" });
  for (let m = 1; m <= 12; m++) {
    const chip = el("button", {
      class: "chip", type: "button", "aria-pressed": "false",
      onClick: () => {
        if (state.bulkMonths.has(m)) state.bulkMonths.delete(m);
        else state.bulkMonths.add(m);
        chip.setAttribute("aria-pressed", String(state.bulkMonths.has(m)));
        paintBulkHint(state, refs);
      },
    }, `${m}월`);
    monthChips.appendChild(chip);
  }
  refs.monthChips = monthChips;

  const allBtn = el("button", {
    class: "btn btn--sm btn--ghost", type: "button",
    onClick: () => {
      const selectAll = state.bulkMonths.size < 12;
      state.bulkMonths = selectAll ? new Set(Array.from({ length: 12 }, (_, i) => i + 1)) : new Set();
      [...monthChips.children].forEach((c, i) =>
        c.setAttribute("aria-pressed", String(state.bulkMonths.has(i + 1))));
      paintBulkHint(state, refs);
    },
  }, "전체 선택/해제");

  refs.bulkHint = el("div", { class: "hint" });

  const saveBtn = el("button", {
    class: "btn btn--primary btn--sm", type: "button",
    onClick: () => applyBulk(state, refs, toCount(refs.countInput.value)),
  }, icon("save", 14), "등교일 전체 채우기");

  const resetBtn = el("button", {
    class: "btn btn--danger btn--sm", type: "button",
    onClick: () => applyBulk(state, refs, 0, true),
  }, icon("refresh", 14), "0명으로 초기화");

  return el("section", { class: "card stack" },
    sectionHead(1, "학생 인원 일괄 등록",
      "선택한 달의 등교일(주말·급식 미실시일 제외)을 같은 인원으로 한 번에 채웁니다."),
    el("div", { class: "row" },
      el("label", { class: "field field--inline" }, el("span", { class: "label" }, "보기"), yearSel, monthSel),
      el("div", { class: "toolbar__divider" }),
      el("label", { class: "field field--inline" }, el("span", { class: "label" }, "인원수"), refs.countInput),
    ),
    el("div", { class: "stack-2" },
      el("div", { class: "row row--tight" },
        el("span", { class: "label", style: { marginBottom: "0" } }, "적용할 달"), allBtn),
      monthChips,
      refs.bulkHint,
    ),
    el("div", { class: "row row--end" }, resetBtn, saveBtn),
  );
}

function paintBulkHint(state, refs) {
  const months = [...state.bulkMonths].sort((a, b) => a - b);
  refs.bulkHint.textContent = months.length
    ? `선택됨: ${months.join(", ")}월 — 이 달들에 일괄 적용됩니다.`
    : `선택된 달이 없으면 보기 중인 ${state.month}월에만 적용됩니다.`;
}

async function applyBulk(state, refs, value, isReset = false) {
  const months = state.bulkMonths.size ? [...state.bulkMonths].sort((a, b) => a - b) : [state.month];
  const label = `${state.year}년 ${months.join(", ")}월`;

  const answer = await confirmDialog({
    title: isReset ? "인원 초기화" : "등교일 전체 채우기",
    message: isReset
      ? `${label}의 등교일 인원을 모두 0명으로 되돌립니다.`
      : `${label}의 등교일을 모두 ${value}명으로 저장합니다.`,
    confirmText: isReset ? "초기화" : "저장",
    tone: isReset ? "danger" : "primary",
  });
  if (answer !== "confirm") return;

  try {
    for (const m of months) {
      const blocked = m === state.month ? state.blocked : null;
      await fillMonth(state.year, m, value, blocked);
      // v1 총원 페이지가 낡은 값을 읽지 않도록 차감 반영본도 동기화
      const fresh = await loadStudentMonth(state.year, m);
      await mirrorEffective(state.year, m, fresh.effective);
    }
    toast(`${label} 저장 완료`, "ok");
    await load(state, refs);
  } catch (e) {
    console.error(e);
    toast("저장에 실패했습니다.", "danger");
  }
}

/* =========================================================
   2. 달력 (일별 조정)
   ========================================================= */

function buildCalendarCard(state, refs) {
  refs.monthTitle = el("span", { class: "badge badge--accent" }, "");
  refs.calSummary = el("div", { class: "row row--tight" });
  refs.calendar = el("div", { class: "cal" }, ...skeletonRows(3, "skeleton--cell"));
  refs.calStatus = el("span", { class: "hint" });

  return el("section", { class: "card stack" },
    sectionHead(2, "일별 학생 인원",
      "숫자는 기준 인원입니다. 결석·체험학습 차감은 아래 표에서 관리되며 붉은 배지로 표시됩니다.",
      refs.monthTitle),
    el("div", { class: "row row--tight" },
      el("span", { class: "legend__item" },
        el("i", { class: "legend__swatch legend__swatch--applied" }), "기준 인원(수정 가능)"),
      el("span", { class: "legend__item" },
        el("i", { class: "legend__swatch legend__swatch--reason" }), "차감 있음"),
      el("span", { class: "spacer" }), refs.calStatus),
    refs.calSummary,
    refs.calendar,
  );
}

function renderCalendar(state, refs) {
  const { year, month } = state;

  const persistDay = debounce(async (day, value) => {
    refs.calStatus.textContent = "저장 중…";
    try {
      await saveStudentDay(year, month, day, value);
      recalcDeductAndPaint(state, refs);
      await mirrorEffective(year, month, buildEffective(state));
      refs.calStatus.textContent = "저장됨";
      setTimeout(() => {
        if (refs.calStatus.textContent === "저장됨") refs.calStatus.textContent = "";
      }, 1600);
    } catch (e) {
      console.error(e);
      refs.calStatus.textContent = "";
      toast("인원 저장에 실패했습니다.", "danger");
    }
  }, SAVE_DEBOUNCE_MS);

  const grid = el("div", { class: "cal" });

  for (let i = 0; i < 7; i++) {
    grid.appendChild(el("div", { class: "cal__dowhead", dataset: { dow: String(i) } }, DOW_LABEL[i]));
  }

  const { padCount, days } = buildMonthGrid(year, month);
  for (let i = 0; i < padCount; i++) {
    grid.appendChild(el("div", { class: "cal__cell cal__cell--pad", "aria-hidden": "true" }));
  }

  for (const day of days) {
    const dow = dowOf(year, month, day);
    const weekend = isWeekend(year, month, day);
    const blocked = state.blocked.includes(day);

    const cell = el("div", {
      class: "cal__cell",
      dataset: { dow: String(dow), day: String(day) },
    },
      el("div", { class: "cal__cellhead" },
        el("span", { class: "cal__date" }, String(day)),
        el("span", { class: "cal__dow" }, `(${DOW_LABEL[dow]})`),
        blocked
          ? el("span", { class: "badge badge--danger cal__note" }, state.notes[String(day)] || "급식 미실시")
          : null,
      ),
    );

    if (weekend || blocked) {
      cell.classList.add(weekend ? "cal__cell--weekend" : "cal__cell--blocked");
      grid.appendChild(cell);
      continue;
    }

    const key = String(day);
    const valueInput = el("input", {
      class: "counter__value", type: "text", inputMode: "numeric",
      value: String(toCount(state.base[key])),
      "aria-label": `${month}월 ${day}일 기준 인원`,
      onFocus: (e) => e.target.select(),
      onInput: (e) => {
        const n = toCount(e.target.value);
        state.base[key] = n;
        persistDay(day, n);
      },
      onBlur: (e) => { e.target.value = String(toCount(state.base[key])); },
    });

    const bump = (delta) => {
      const next = Math.max(0, toCount(state.base[key]) + delta);
      state.base[key] = next;
      valueInput.value = String(next);
      persistDay(day, next);
      paintDeduct();
    };

    const counter = el("div", { class: "counter" },
      el("button", {
        class: "counter__btn", type: "button", "aria-label": "1명 감소",
        onClick: () => bump(-1),
      }, icon("minus", 13)),
      valueInput,
      el("button", {
        class: "counter__btn", type: "button", "aria-label": "1명 증가",
        onClick: () => bump(1),
      }, icon("plus", 13)),
    );

    const deductEl = el("div", { class: "cal__deduct" });
    const paintDeduct = () => {
      const minus = toCount(state.deduct[key]);
      if (minus > 0) {
        cell.classList.add("cal__cell--has-reason");
        deductEl.textContent = `−${minus} → 실제 ${Math.max(0, toCount(state.base[key]) - minus)}명`;
      } else {
        cell.classList.remove("cal__cell--has-reason");
        deductEl.textContent = "";
      }
    };

    cell._paintDeduct = paintDeduct;
    cell.appendChild(el("div", { class: "cal__body" }, counter, deductEl));
    paintDeduct();
    grid.appendChild(cell);
  }

  refs.calendar.replaceWith(grid);
  refs.calendar = grid;

  refs.monthTitle.textContent = `${year}년 ${month}월`;
  paintCalSummary(state, refs);
}

function buildEffective(state) {
  const effective = {};
  for (const day of state.schoolDays) {
    const key = String(day);
    effective[key] = Math.max(0, toCount(state.base[key]) - toCount(state.deduct[key]));
  }
  return effective;
}

function recalcDeductAndPaint(state, refs) {
  state.deduct = computeDeductions(state.absences, state.year, state.month, state.blocked);
  for (const cell of refs.calendar.children) {
    if (cell._paintDeduct) cell._paintDeduct();
  }
  paintCalSummary(state, refs);
}

function paintCalSummary(state, refs) {
  const effective = buildEffective(state);
  const sumBase = state.schoolDays.reduce((a, d) => a + toCount(state.base[String(d)]), 0);
  const sumEff = Object.values(effective).reduce((a, v) => a + v, 0);

  render(refs.calSummary,
    el("span", { class: "badge" }, `급식 실시 ${state.schoolDays.length}일`),
    el("span", { class: "badge badge--accent" }, `기준 합계 ${sumBase.toLocaleString()}식`),
    sumBase !== sumEff
      ? el("span", { class: "badge badge--warn" },
          el("i", { class: "badge__dot" }), `차감 후 ${sumEff.toLocaleString()}식`)
      : null,
  );
}

/* =========================================================
   3. 결석 / 체험학습 표
   ========================================================= */

function buildAbsenceCard(state, refs) {
  refs.absenceBody = el("tbody");

  const addBtn = el("button", {
    class: "btn btn--sm", type: "button",
    onClick: () => refs.absenceBody.appendChild(makeAbsenceRow(state)),
  }, icon("plus", 14), "행 추가");

  const saveBtn = el("button", {
    class: "btn btn--primary btn--sm", type: "button",
    onClick: () => persistAbsences(state, refs),
  }, icon("save", 14), "표 저장");

  return el("section", { class: "card stack" },
    sectionHead(3, "취업·현장체험학습 등 급식 미실시 학생",
      "기간이 달을 걸쳐도(예: 8/28~9/2) 겹치는 날짜만 정확히 차감됩니다."),
    el("div", { class: "table-wrap" },
      el("table", { class: "table" },
        el("thead", null,
          el("tr", null,
            el("th", null, "상황"),
            el("th", { style: { width: "110px" } }, "인원"),
            el("th", { style: { width: "170px" } }, "시작일"),
            el("th", { style: { width: "170px" } }, "종료일"),
            el("th", { style: { width: "80px" } }, ""),
          )),
        refs.absenceBody,
      ),
    ),
    el("div", { class: "row" },
      el("span", { class: "hint" }, "예) 현장체험학습 · 3명 · 2026-09-18 ~ 2026-09-19"),
      el("span", { class: "spacer" }), addBtn, saveBtn),
  );
}

function makeAbsenceRow(state, item = { situation: "", count: 1, start: "", end: "" }) {
  const situation = el("input", {
    class: "input input--sm", type: "text", maxLength: 60,
    placeholder: "예: 현장체험학습", value: item.situation || "",
  });
  const count = el("input", {
    class: "input input--sm input--num", type: "number", min: "0",
    value: String(toCount(item.count)), inputMode: "numeric",
  });

  const defaultStart = item.start || isoDate(state.year, state.month, 1);
  const start = el("input", { class: "input input--sm", type: "date", value: defaultStart });
  const end = el("input", { class: "input input--sm", type: "date", value: item.end || defaultStart });

  const tr = el("tr", null,
    el("td", null, situation),
    el("td", null, count),
    el("td", null, start),
    el("td", null, end),
    el("td", null,
      el("button", {
        class: "btn btn--sm btn--danger btn--icon", type: "button",
        title: "행 삭제", "aria-label": "행 삭제",
        onClick: () => tr.remove(),
      }, icon("trash", 14)),
    ),
  );

  tr._fields = { situation, count, start, end };
  return tr;
}

function collectAbsences(refs) {
  const items = [];
  for (const tr of refs.absenceBody.children) {
    if (!tr._fields) continue;
    const { situation, count, start, end } = tr._fields;
    const s = situation.value.trim();
    const c = toCount(count.value);
    const st = start.value;
    const en = end.value;

    if (!s && !c && !st && !en) continue;
    if (!st || !en) return { error: "기간의 시작일과 종료일을 모두 입력해 주세요." };
    if (st > en) return { error: "시작일이 종료일보다 뒤입니다." };
    if (!s) return { error: "상황을 입력해 주세요." };

    items.push({ situation: s, count: c, start: st, end: en });
  }
  return { items };
}

async function persistAbsences(state, refs) {
  const { items, error } = collectAbsences(refs);
  if (error) { toast(error, "warn"); return; }

  try {
    await saveAbsences(state.year, state.month, items);
    state.absences = items;
    recalcDeductAndPaint(state, refs);
    await mirrorEffective(state.year, state.month, buildEffective(state));
    toast("표가 저장되었습니다. 달력과 집계에 즉시 반영됩니다.", "ok");
  } catch (e) {
    console.error(e);
    toast("표 저장에 실패했습니다.", "danger");
  }
}

/* =========================================================
   로딩
   ========================================================= */

async function load(state, refs) {
  const myToken = token.next();

  try {
    const data = await loadStudentMonth(state.year, state.month);
    if (token.isStale(myToken)) return;

    state.base = data.base;
    state.blocked = data.blocked;
    state.notes = data.notes;
    state.absences = data.absences;
    state.deduct = data.deduct;
    state.schoolDays = data.schoolDays;

    renderCalendar(state, refs);
    paintBulkHint(state, refs);

    render(refs.absenceBody);
    if (!state.absences.length) {
      refs.absenceBody.appendChild(makeAbsenceRow(state));
    } else {
      for (const item of state.absences) refs.absenceBody.appendChild(makeAbsenceRow(state, item));
    }
  } catch (e) {
    console.error("[students] 로딩 실패:", e);
    if (token.isStale(myToken)) return;
    toast("학생 인원 정보를 불러오지 못했습니다.", "danger");
    render(refs.calendar, emptyState({ icon: "alert", title: "불러오기 실패", desc: e?.message || "" }));
  }
}
