/* =========================================================
   admin/totals-view.js — 일자별 총 급식 인원 (학생 + 교사)

   v1 대비 변경
   - 연/월을 바꾸면 즉시 다시 계산합니다. (v1 은 이벤트가 주석 처리되어
     달을 바꿔도 화면이 그대로였습니다)
   - 화면을 열기만 해도 Firestore 에 쓰던 동작을 없앴습니다.
     저장은 [총원 저장] 버튼을 눌렀을 때만 일어납니다.
   ========================================================= */

import {
  el, icon, render, toast, createRenderToken, skeletonRows, emptyState,
} from "../../util/dom.js";
import { sectionHead } from "../../ui/shell.js";
import { yearOptions, pad2 } from "../../util/date.js";
import { computeTotals, saveTotals, toCsv } from "../../repo/totals.js";
import { getRoster, findNonApplicants } from "../../repo/staff.js";

const token = createRenderToken();

export async function mount(container, ctx) {
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    result: null,
    roster: [],
  };

  const refs = {};

  container.appendChild(
    el("div", { class: "stack-8" },
      buildToolbar(state, refs),
      buildStats(refs),
      el("div", { class: "grid-2" },
        buildListCard(refs),
        buildSummaryCard(refs),
      ),
    ),
  );

  await load(state, refs);
}

/* =========================================================
   툴바
   ========================================================= */

function buildToolbar(state, refs) {
  const yearSel = el("select", {
    class: "select select--sm", style: { width: "110px" },
    onChange: () => { state.year = Number(yearSel.value); load(state, refs); },
  }, ...yearOptions().map((y) => el("option", { value: String(y), selected: y === state.year }, `${y}년`)));

  const monthSel = el("select", {
    class: "select select--sm", style: { width: "95px" },
    onChange: () => { state.month = Number(monthSel.value); load(state, refs); },
  }, ...Array.from({ length: 12 }, (_, i) =>
    el("option", { value: String(i + 1), selected: i + 1 === state.month }, `${i + 1}월`)));

  refs.saveBtn = el("button", {
    class: "btn btn--primary btn--sm", type: "button", disabled: true,
    onClick: () => handleSave(state, refs),
  }, icon("save", 14), "총원 저장");

  refs.csvBtn = el("button", {
    class: "btn btn--sm", type: "button", disabled: true,
    onClick: () => downloadCsv(state),
  }, icon("download", 14), "CSV 내려받기");

  refs.reloadBtn = el("button", {
    class: "btn btn--sm", type: "button",
    onClick: () => load(state, refs),
  }, icon("refresh", 14), "다시 계산");

  return el("section", { class: "card" },
    sectionHead(null, "총원 집계",
      "학생(차감 반영) + 교사 신청 인원을 날짜별로 합산합니다. 화면을 여는 것만으로는 저장되지 않습니다."),
    el("div", { class: "row" },
      yearSel, monthSel,
      el("span", { class: "spacer" }),
      refs.reloadBtn, refs.csvBtn, refs.saveBtn),
  );
}

/* =========================================================
   통계
   ========================================================= */

function buildStats(refs) {
  refs.stats = el("div", { class: "stat-row" }, ...skeletonRows(4, "skeleton--row"));
  return refs.stats;
}

function paintStats(state, refs) {
  const r = state.result;
  const stat = (label, value, unit, mod = "") =>
    el("div", { class: `stat ${mod}` },
      el("div", { class: "stat__label" }, label),
      el("div", { class: "stat__value" }, value.toLocaleString(), el("span", { class: "stat__unit" }, unit)));

  const avg = r.rows.length ? Math.round(r.sumTotal / r.rows.length) : 0;

  render(refs.stats,
    stat("급식 실시일", r.rows.length, "일"),
    stat("총 식수", r.sumTotal, "식", "stat--accent"),
    stat("학생", r.sumStudents, "식"),
    stat("교사", r.sumTeachers, "식"),
    stat("1일 평균", avg, "식", "stat--warn"),
  );
}

/* =========================================================
   일자별 목록
   ========================================================= */

function buildListCard(refs) {
  refs.listTitle = el("span", { class: "badge badge--accent" }, "");
  refs.list = el("div", { class: "day-list" }, ...skeletonRows(6));

  return el("section", { class: "card stack" },
    sectionHead(null, "일자별 인원", "학생 · 교사 · 합계", refs.listTitle),
    el("div", { class: "card card--flush card--inset" }, refs.list),
  );
}

function paintList(state, refs) {
  const r = state.result;
  refs.listTitle.textContent = `${state.year}년 ${pad2(state.month)}월`;

  if (!r.rows.length) {
    render(refs.list, emptyState({
      title: "급식 실시일이 없습니다",
      desc: "월 설정에서 급식 미실시일을 확인해 주세요.",
    }));
    return;
  }

  const wrap = el("div");
  for (const row of r.rows) {
    wrap.appendChild(
      el("div", { class: "day-row" },
        el("div", null,
          el("span", { class: "day-row__date" }, `${pad2(state.month)}.${pad2(row.day)}`),
          el("span", { class: "day-row__dow" }, row.dowLabel),
        ),
        el("div", { class: "day-row__nums" },
          el("span", { class: "day-row__part" }, `학생 ${row.students}`),
          el("span", { class: "day-row__part" }, `교사 ${row.teachers}`),
          el("span", { class: "day-row__total" }, `${row.total}명`),
        ),
      ),
    );
  }

  wrap.appendChild(
    el("div", { class: "day-row", style: { background: "var(--surface-2)", fontWeight: "600" } },
      el("div", { class: "day-row__date" }, "합계"),
      el("div", { class: "day-row__nums" },
        el("span", { class: "day-row__part" }, `학생 ${r.sumStudents}`),
        el("span", { class: "day-row__part" }, `교사 ${r.sumTeachers}`),
        el("span", { class: "day-row__total" }, `${r.sumTotal}명`),
      ),
    ),
  );

  render(refs.list, wrap);
}

/* =========================================================
   요약 (교사 미신청 · 사유 · 학생 변동)
   ========================================================= */

function buildSummaryCard(refs) {
  refs.summary = el("div", { class: "stack" }, ...skeletonRows(5));
  return el("section", { class: "card stack" },
    sectionHead(null, "특이사항 요약", "급식실 제출 시 함께 전달할 내용"),
    refs.summary,
  );
}

function paintSummary(state, refs) {
  const r = state.result;
  const blocks = [];

  const subhead = (text, count = null, tone = null) =>
    el("div", { class: "row row--tight" },
      el("span", { class: "strong small" }, text),
      count !== null ? el("span", { class: `badge${tone ? ` badge--${tone}` : ""}` }, String(count)) : null);

  /* --- 교사 미신청자 --- */
  const { noRequest, emptyDays, usingRoster } = findNonApplicants(state.roster, r.requests);
  const nonApplicants = [
    ...noRequest.map((m) => m.name),
    ...emptyDays.map((m) => m.name),
  ];

  blocks.push(
    el("div", { class: "stack-2" },
      subhead("교사 미신청자", nonApplicants.length, nonApplicants.length ? "warn" : "ok"),
      nonApplicants.length
        ? el("div", { class: "chip-group" }, ...nonApplicants.map((n) => el("span", { class: "chip" }, n)))
        : el("div", { class: "hint" }, "전원 신청했습니다."),
      !usingRoster
        ? el("div", { class: "hint" },
            "※ 교직원 명부가 비어 있어, 신청 기록이 있는 교사만 대상으로 판단했습니다.")
        : null,
    ),
  );

  /* --- 일자별 미신청 사유 --- */
  const reasonDays = Object.keys(r.reasonsByDay).map(Number).sort((a, b) => a - b);
  const reasonCount = reasonDays.reduce((sum, d) => sum + r.reasonsByDay[String(d)].length, 0);

  blocks.push(
    el("div", { class: "stack-2" },
      subhead("교사 미신청 사유", reasonCount, reasonCount ? "warn" : null),
      reasonDays.length
        ? el("ul", { class: "stack-2" },
            ...reasonDays.map((day) =>
              el("li", { class: "small" },
                el("span", { class: "badge badge--warn" }, `${state.month}/${day}`),
                " ",
                r.reasonsByDay[String(day)]
                  .map((e) => `${e.name}(${e.reason})`)
                  .join(", "),
              )))
        : el("div", { class: "hint" }, "입력된 사유가 없습니다."),
    ),
  );

  /* --- 학생 변동 내역 --- */
  const absences = r.student.absences;
  const fmt = (iso) => (iso && iso.length >= 10 ? `${iso.slice(5, 7)}.${iso.slice(8, 10)}` : "-");

  blocks.push(
    el("div", { class: "stack-2" },
      subhead("학생 급식 변동", absences.length, absences.length ? "warn" : null),
      absences.length
        ? el("ul", { class: "stack-2" },
            ...absences.map((it) => {
              const s = fmt(it.start);
              const e = fmt(it.end);
              return el("li", { class: "small" },
                el("span", { class: "badge" }, s === e ? s : `${s}~${e}`),
                ` ${it.situation} ${it.count}명`);
            }))
        : el("div", { class: "hint" }, "등록된 변동 내역이 없습니다."),
    ),
  );

  /* --- 급식 미실시일 --- */
  blocks.push(
    el("div", { class: "stack-2" },
      subhead("급식 미실시일", r.blocked.length, r.blocked.length ? "danger" : null),
      r.blocked.length
        ? el("div", { class: "chip-group" },
            ...r.blocked.map((d) =>
              el("span", { class: "chip", title: r.notes[String(d)] || "급식 미실시" },
                `${d}일 · ${r.notes[String(d)] || "미실시"}`)))
        : el("div", { class: "hint" }, "이번 달은 매 평일 급식을 실시합니다."),
    ),
  );

  render(refs.summary, ...blocks);
}

/* =========================================================
   저장 · CSV
   ========================================================= */

async function handleSave(state, refs) {
  const r = state.result;
  if (!r) return;

  refs.saveBtn.disabled = true;
  const original = [...refs.saveBtn.childNodes];
  refs.saveBtn.replaceChildren(el("span", { class: "btn__spinner" }), "저장 중…");

  try {
    await saveTotals(state.year, state.month, r.rows, r.student.effective);
    toast("총원이 저장되었습니다.", "ok");
  } catch (e) {
    console.error(e);
    toast("총원 저장에 실패했습니다.", "danger");
  } finally {
    refs.saveBtn.disabled = false;
    refs.saveBtn.replaceChildren(...original);
  }
}

function downloadCsv(state) {
  const r = state.result;
  if (!r) return;

  // BOM 을 붙여 엑셀에서 한글이 깨지지 않도록
  const blob = new Blob(["﻿" + toCsv(state.year, state.month, r.rows)],
    { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = el("a", {
    href: url,
    download: `급식인원_${state.year}-${pad2(state.month)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   로딩
   ========================================================= */

async function load(state, refs) {
  const myToken = token.next();

  refs.saveBtn.disabled = true;
  refs.csvBtn.disabled = true;
  render(refs.list, ...skeletonRows(6));
  render(refs.summary, ...skeletonRows(5));

  try {
    const [result, roster] = await Promise.all([
      computeTotals(state.year, state.month),   // 읽기 전용
      getRoster(),
    ]);

    if (token.isStale(myToken)) return;

    state.result = result;
    state.roster = roster;

    paintStats(state, refs);
    paintList(state, refs);
    paintSummary(state, refs);

    refs.saveBtn.disabled = false;
    refs.csvBtn.disabled = false;
  } catch (e) {
    console.error("[totals] 계산 실패:", e);
    if (token.isStale(myToken)) return;
    toast("총원을 계산하지 못했습니다.", "danger");
    render(refs.list, emptyState({ icon: "alert", title: "계산 실패", desc: e?.message || "" }));
    render(refs.summary, emptyState({ icon: "alert", title: "요약을 불러오지 못했습니다" }));
  }
}
