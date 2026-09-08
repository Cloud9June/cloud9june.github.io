/* =========================================================
   admin/settings-view.js — 신청 연도 · 월 상태 · 급식 미실시일 · 교직원 명부
   ========================================================= */

import { MONTH_STATUS, MONTH_STATUS_LABEL, MONTH_STATUS_CYCLE, SAVE_DEBOUNCE_MS } from "../../config.js";
import {
  el, icon, render, toast, debounce, createRenderToken, skeletonRows, confirmDialog,
} from "../../util/dom.js";
import { sectionHead } from "../../ui/shell.js";
import { DOW_LABEL, buildMonthGrid, dowOf, isWeekend, yearOptions } from "../../util/date.js";
import {
  getMonthStatuses, setMonthStatus, getBlocked, setBlocked,
  getTeacherYear, setTeacherYear,
} from "../../repo/settings.js";
import { getRoster, saveRoster, parseRosterText, rosterToText } from "../../repo/staff.js";

const blockedToken = createRenderToken();

export async function mount(container, ctx) {
  const now = new Date();

  const state = {
    statusYear: now.getFullYear(),
    blockYear: now.getFullYear(),
    blockMonth: now.getMonth() + 1,
    blockedSet: new Set(),
    notes: {},
  };

  const refs = {};

  container.appendChild(
    el("div", { class: "stack-8" },
      buildTeacherYearCard(refs),
      buildMonthStatusCard(state, refs),
      buildBlockedCard(state, refs),
      buildRosterCard(refs),
    ),
  );

  await Promise.all([
    loadTeacherYear(refs),
    loadMonthStatuses(state, refs),
    loadBlocked(state, refs),
    loadRoster(refs),
  ]);
}

/* =========================================================
   1. 교사 신청 연도
   ========================================================= */

function buildTeacherYearCard(refs) {
  refs.teacherYearSelect = el("select", { class: "select", style: { width: "130px" } },
    ...yearOptions(new Date().getFullYear(), 1, 2).map((y) =>
      el("option", { value: String(y) }, `${y}년`)),
  );

  refs.teacherYearSaveBtn = el("button", {
    class: "btn btn--primary", type: "button",
    onClick: async () => {
      const year = Number(refs.teacherYearSelect.value);
      try {
        await setTeacherYear(year);
        toast(`교사 신청 연도를 ${year}년으로 저장했습니다.`, "ok");
      } catch (e) {
        console.error(e);
        toast("저장에 실패했습니다.", "danger");
      }
    },
  }, icon("save", 15), "저장");

  return el("section", { class: "card" },
    sectionHead(1, "교사 신청 대상 연도",
      "교사 신청 화면에 어떤 연도의 달력을 보여줄지 결정합니다."),
    el("div", { class: "row" }, refs.teacherYearSelect, refs.teacherYearSaveBtn),
  );
}

async function loadTeacherYear(refs) {
  try {
    const year = await getTeacherYear();
    refs.teacherYearSelect.value = String(year);
  } catch (e) {
    console.error(e);
    toast("교사 신청 연도를 불러오지 못했습니다.", "warn");
  }
}

/* =========================================================
   2. 월별 신청 상태
   ========================================================= */

function buildMonthStatusCard(state, refs) {
  refs.statusYearSelect = el("select", {
    class: "select select--sm", style: { width: "120px" },
    onChange: () => {
      state.statusYear = Number(refs.statusYearSelect.value);
      loadMonthStatuses(state, refs);
    },
  }, ...yearOptions(new Date().getFullYear(), 1, 2).map((y) =>
    el("option", { value: String(y), selected: y === state.statusYear }, `${y}년`)));

  refs.monthGrid = el("div", { class: "month-grid" }, ...skeletonRows(1, "skeleton--cell"));

  const legend = el("div", { class: "legend" },
    el("span", { class: "legend__item" }, el("span", { class: "badge" }, "미오픈"), "진입 불가"),
    el("span", { class: "legend__item" }, el("span", { class: "badge badge--accent" }, "신청중"), "신청·수정 가능"),
    el("span", { class: "legend__item" }, el("span", { class: "badge badge--warn" }, "조회전용"), "마감, 조회만"),
  );

  return el("section", { class: "card stack" },
    sectionHead(2, "월별 신청 상태",
      "월 버튼을 누를 때마다 미오픈 → 신청중 → 조회전용 순서로 바뀝니다.",
      refs.statusYearSelect),
    legend,
    refs.monthGrid,
  );
}

async function loadMonthStatuses(state, refs) {
  render(refs.monthGrid, ...Array.from({ length: 12 }, () =>
    el("div", { class: "skeleton skeleton--cell", style: { height: "66px" } })));

  try {
    const statuses = await getMonthStatuses(state.statusYear);
    const grid = el("div", { class: "month-grid" });

    for (let m = 1; m <= 12; m++) {
      let status = statuses[m] ?? MONTH_STATUS.CLOSED;

      const stateLabel = el("span", { class: "month-status-btn__state" }, MONTH_STATUS_LABEL[status]);
      const btn = el("button", {
        class: "month-status-btn",
        type: "button",
        dataset: { status: String(status) },
        "aria-label": `${m}월 현재 ${MONTH_STATUS_LABEL[status]} — 눌러서 변경`,
      }, el("span", null, `${m}월`), stateLabel);

      btn.addEventListener("click", async () => {
        const next = MONTH_STATUS_CYCLE[(MONTH_STATUS_CYCLE.indexOf(status) + 1) % MONTH_STATUS_CYCLE.length];
        const previous = status;

        // 낙관적 업데이트 후 실패 시 원복
        status = next;
        btn.dataset.status = String(next);
        stateLabel.textContent = MONTH_STATUS_LABEL[next];
        btn.disabled = true;

        try {
          await setMonthStatus(state.statusYear, m, next);
          toast(`${state.statusYear}년 ${m}월 · ${MONTH_STATUS_LABEL[next]}`, "ok", 1600);
        } catch (e) {
          console.error(e);
          status = previous;
          btn.dataset.status = String(previous);
          stateLabel.textContent = MONTH_STATUS_LABEL[previous];
          toast("상태 변경에 실패했습니다.", "danger");
        } finally {
          btn.disabled = false;
        }
      });

      grid.appendChild(btn);
    }

    refs.monthGrid.replaceWith(grid);
    refs.monthGrid = grid;
  } catch (e) {
    console.error(e);
    render(refs.monthGrid, el("div", { class: "banner banner--danger" }, "월 상태를 불러오지 못했습니다."));
  }
}

/* =========================================================
   3. 급식 미실시일
   ========================================================= */

function buildBlockedCard(state, refs) {
  const yearSel = el("select", {
    class: "select select--sm", style: { width: "110px" },
    onChange: () => { state.blockYear = Number(yearSel.value); loadBlocked(state, refs); },
  }, ...yearOptions(new Date().getFullYear(), 1, 2).map((y) =>
    el("option", { value: String(y), selected: y === state.blockYear }, `${y}년`)));

  const monthSel = el("select", {
    class: "select select--sm", style: { width: "95px" },
    onChange: () => { state.blockMonth = Number(monthSel.value); loadBlocked(state, refs); },
  }, ...Array.from({ length: 12 }, (_, i) =>
    el("option", { value: String(i + 1), selected: i + 1 === state.blockMonth }, `${i + 1}월`)));

  const step = (delta) => {
    let y = state.blockYear;
    let m = state.blockMonth + delta;
    if (m === 0) { m = 12; y -= 1; }
    if (m === 13) { m = 1; y += 1; }
    state.blockYear = y;
    state.blockMonth = m;
    yearSel.value = String(y);
    monthSel.value = String(m);
    loadBlocked(state, refs);
  };

  refs.blockStatus = el("span", { class: "hint" });
  refs.blockCalendar = el("div", { class: "cal" }, ...skeletonRows(3, "skeleton--cell"));
  refs.blockSummary = el("div", { class: "row row--tight" });

  return el("section", { class: "card stack" },
    sectionHead(3, "급식 미실시일 설정",
      "체크한 날은 교사 신청 달력에서 선택할 수 없고, 총원 집계에서도 제외됩니다."),
    el("div", { class: "row" },
      el("button", { class: "btn btn--sm", type: "button", onClick: () => step(-1) }, "‹ 이전 달"),
      yearSel, monthSel,
      el("button", { class: "btn btn--sm", type: "button", onClick: () => step(1) }, "다음 달 ›"),
      el("span", { class: "spacer" }),
      refs.blockStatus,
    ),
    refs.blockSummary,
    refs.blockCalendar,
  );
}

async function loadBlocked(state, refs) {
  const token = blockedToken.next();
  refs.blockStatus.textContent = "불러오는 중…";

  try {
    const { days, notes } = await getBlocked(state.blockYear, state.blockMonth);
    if (blockedToken.isStale(token)) return;

    state.blockedSet = new Set(days);
    state.notes = { ...notes };
    refs.blockStatus.textContent = "";
    renderBlockedCalendar(state, refs);
  } catch (e) {
    console.error(e);
    if (blockedToken.isStale(token)) return;
    refs.blockStatus.textContent = "";
    render(refs.blockCalendar,
      el("div", { class: "banner banner--danger" }, "미실시일 정보를 불러오지 못했습니다."));
  }
}

function renderBlockedCalendar(state, refs) {
  const { blockYear: year, blockMonth: month } = state;

  const persist = debounce(async () => {
    refs.blockStatus.textContent = "저장 중…";
    try {
      await setBlocked(year, month, [...state.blockedSet], state.notes);
      refs.blockStatus.textContent = "저장됨";
      setTimeout(() => { if (refs.blockStatus.textContent === "저장됨") refs.blockStatus.textContent = ""; }, 1800);
    } catch (e) {
      console.error(e);
      refs.blockStatus.textContent = "";
      toast("미실시일 저장에 실패했습니다.", "danger");
    }
  }, SAVE_DEBOUNCE_MS);

  const updateSummary = () => {
    const count = state.blockedSet.size;
    render(refs.blockSummary,
      el("span", { class: "badge badge--danger" },
        el("i", { class: "badge__dot" }), `미실시 ${count}일`),
      count
        ? el("span", { class: "badge" },
            [...state.blockedSet].sort((a, b) => a - b).map((d) => `${d}일`).join(", "))
        : el("span", { class: "badge badge--ok" }, "이번 달은 모두 급식 실시"),
    );
  };

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

    const cell = el("div", {
      class: `cal__cell cal__cell--blockedit${weekend ? " cal__cell--weekend" : ""}`,
      dataset: { dow: String(dow) },
    },
      el("div", { class: "cal__cellhead" },
        el("span", { class: "cal__date" }, String(day)),
        el("span", { class: "cal__dow" }, `(${DOW_LABEL[dow]})`),
      ),
    );

    if (weekend) { grid.appendChild(cell); continue; }

    const noteInput = el("input", {
      class: "input input--sm",
      type: "text",
      maxLength: 30,
      placeholder: "예: 재량휴업일",
      value: state.notes[String(day)] || "",
      onInput: (e) => {
        state.notes[String(day)] = e.target.value.trim() || "급식 미실시";
        persist();
      },
      onClick: (e) => e.stopPropagation(),
    });

    const noteWrap = el("div", { class: "cal__blocknote" }, noteInput);

    const toggle = el("button", {
      class: "cal__toggle",
      type: "button",
      "aria-pressed": String(state.blockedSet.has(day)),
    }, state.blockedSet.has(day) ? "미실시" : "급식 실시");

    const paint = () => {
      const on = state.blockedSet.has(day);
      cell.classList.toggle("cal__cell--blocked", on);
      toggle.setAttribute("aria-pressed", String(on));
      toggle.textContent = on ? "미실시" : "급식 실시";
      noteWrap.style.display = on ? "" : "none";
    };

    toggle.addEventListener("click", () => {
      if (state.blockedSet.has(day)) {
        state.blockedSet.delete(day);
        delete state.notes[String(day)];
      } else {
        state.blockedSet.add(day);
        if (!state.notes[String(day)]) state.notes[String(day)] = noteInput.value.trim() || "급식 미실시";
      }
      paint();
      updateSummary();
      persist();
    });

    cell.appendChild(el("div", { class: "cal__body" }, toggle, noteWrap));
    paint();
    grid.appendChild(cell);
  }

  refs.blockCalendar.replaceWith(grid);
  refs.blockCalendar = grid;
  updateSummary();
}

/* =========================================================
   4. 교직원 명부
   ========================================================= */

function buildRosterCard(refs) {
  refs.rosterArea = el("textarea", {
    class: "textarea",
    rows: 8,
    placeholder: "홍길동, hong@sungil-i.kr\n김영희, kim@sungil-i.kr",
    style: { fontFamily: "var(--font-num)", fontSize: "13px" },
  });

  refs.rosterCount = el("span", { class: "badge" }, "0명");

  const saveBtn = el("button", {
    class: "btn btn--primary", type: "button",
    onClick: async () => {
      const members = parseRosterText(refs.rosterArea.value);
      if (!members.length) {
        const answer = await confirmDialog({
          title: "명부를 비웁니다",
          message: "입력된 교직원이 없습니다. 명부를 비우면 미신청자 자동 대조 기능이 꺼집니다.",
          confirmText: "비우기",
          tone: "danger",
        });
        if (answer !== "confirm") return;
      }
      try {
        const saved = await saveRoster(members);
        refs.rosterArea.value = rosterToText(saved);
        refs.rosterCount.textContent = `${saved.length}명`;
        toast(`교직원 ${saved.length}명을 저장했습니다.`, "ok");
      } catch (e) {
        console.error(e);
        toast("명부 저장에 실패했습니다.", "danger");
      }
    },
  }, icon("save", 15), "명부 저장");

  return el("section", { class: "card stack" },
    sectionHead(4, "교직원 명부",
      "한 줄에 한 명씩 «이름, 이메일» 형식으로 입력합니다. 이 명부가 있어야 " +
      "'한 번도 신청 화면에 들어오지 않은 교사'까지 미신청자로 잡아낼 수 있습니다."),
    el("div", { class: "row row--tight" }, refs.rosterCount,
      el("span", { class: "hint" }, "쉼표 또는 탭으로 구분")),
    refs.rosterArea,
    el("div", { class: "row row--end" }, saveBtn),
  );
}

async function loadRoster(refs) {
  try {
    const members = await getRoster();
    refs.rosterArea.value = rosterToText(members);
    refs.rosterCount.textContent = `${members.length}명`;
  } catch (e) {
    console.error(e);
    toast("교직원 명부를 불러오지 못했습니다.", "warn");
  }
}
