/* =========================================================
   admin/teachers-view.js — 교사 신청 현황 · 미신청자 · 미신청 사유
   ========================================================= */

import {
  el, icon, render, toast, confirmDialog, createRenderToken, skeletonRows, emptyState,
} from "../../util/dom.js";
import { sectionHead } from "../../ui/shell.js";
import {
  DOW_LABEL, dowOf, yearOptions, formatDateTime, getSchoolDays,
} from "../../util/date.js";
import { listMonthRequests, adminRemoveDay, adminAddDay } from "../../repo/requests.js";
import { getBlocked } from "../../repo/settings.js";
import { getRosterSafe, findNonApplicants } from "../../repo/staff.js";

const token = createRenderToken();

export async function mount(container, ctx) {
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    nameQuery: "",
    dayFilter: "",
    requests: [],
    roster: [],
    blocked: [],
    schoolDays: [],
  };

  const refs = {};

  container.appendChild(
    el("div", { class: "stack-8" },
      buildFilterCard(state, refs),
      buildStatsCard(refs),
      buildRequestsCard(state, refs),
      buildNonApplicantsCard(refs),
      buildReasonsCard(refs),
      buildAddCard(state, refs),
    ),
  );

  await load(state, refs);
}

/* =========================================================
   필터
   ========================================================= */

function buildFilterCard(state, refs) {
  const yearSel = el("select", {
    class: "select select--sm", style: { width: "110px" },
    onChange: () => { state.year = Number(yearSel.value); load(state, refs); },
  }, ...yearOptions().map((y) => el("option", { value: String(y), selected: y === state.year }, `${y}년`)));

  const monthSel = el("select", {
    class: "select select--sm", style: { width: "95px" },
    onChange: () => { state.month = Number(monthSel.value); load(state, refs); },
  }, ...Array.from({ length: 12 }, (_, i) =>
    el("option", { value: String(i + 1), selected: i + 1 === state.month }, `${i + 1}월`)));

  refs.daySelect = el("select", {
    class: "select select--sm", style: { width: "110px" },
    onChange: () => { state.dayFilter = refs.daySelect.value; paintRequests(state, refs); },
  }, el("option", { value: "" }, "날짜 전체"));

  const nameInput = el("input", {
    class: "input input--sm", type: "search", placeholder: "이름 검색",
    style: { width: "160px" },
    onInput: () => { state.nameQuery = nameInput.value.trim(); paintRequests(state, refs); },
  });

  refs.reloadBtn = el("button", {
    class: "btn btn--sm", type: "button",
    onClick: () => load(state, refs),
  }, icon("refresh", 14), "새로고침");

  return el("section", { class: "card" },
    sectionHead(1, "조회 조건", "연·월을 바꾸면 자동으로 다시 불러옵니다."),
    el("div", { class: "row" },
      yearSel, monthSel, refs.daySelect, nameInput,
      el("span", { class: "spacer" }), refs.reloadBtn),
  );
}

/* =========================================================
   통계
   ========================================================= */

function buildStatsCard(refs) {
  refs.stats = el("div", { class: "stat-row" }, ...skeletonRows(4, "skeleton--row"));
  return refs.stats;
}

function paintStats(state, refs) {
  const applied = state.requests.filter((r) => r.days.length > 0);
  const totalMeals = state.requests.reduce((sum, r) => sum + r.days.length, 0);
  const reasonCount = state.requests.reduce((sum, r) => sum + Object.keys(r.reasons).length, 0);

  const stat = (label, value, unit, mod = "") =>
    el("div", { class: `stat ${mod}` },
      el("div", { class: "stat__label" }, label),
      el("div", { class: "stat__value" }, String(value), el("span", { class: "stat__unit" }, unit)));

  render(refs.stats,
    stat("신청 교사", applied.length, "명", "stat--accent"),
    stat("미신청 교사", state.requests.length - applied.length, "명"),
    stat("총 식수(교사)", totalMeals, "식"),
    stat("미신청 사유", reasonCount, "건", "stat--warn"),
  );
}

/* =========================================================
   신청 현황 표
   ========================================================= */

function buildRequestsCard(state, refs) {
  refs.requestsBody = el("tbody");
  refs.requestsCount = el("span", { class: "badge" }, "0명");

  return el("section", { class: "card stack" },
    sectionHead(2, "교사별 신청 현황",
      "신청일 칩을 누르면 해당 날짜의 신청을 취소할 수 있습니다.",
      refs.requestsCount),
    el("div", { class: "table-wrap" },
      el("table", { class: "table" },
        el("thead", null,
          el("tr", null,
            el("th", { style: { width: "130px" } }, "이름"),
            el("th", { style: { width: "210px" } }, "이메일"),
            el("th", null, "신청일"),
            el("th", { style: { width: "220px" } }, "미신청 사유"),
            el("th", { style: { width: "120px" } }, "최종 저장"),
          )),
        refs.requestsBody,
      ),
    ),
  );
}

function paintRequests(state, refs) {
  const query = state.nameQuery;
  const dayFilter = state.dayFilter ? Number(state.dayFilter) : null;

  const rows = state.requests.filter((r) => {
    if (query && !r.name.includes(query) && !r.email.includes(query)) return false;
    if (dayFilter && !r.days.includes(dayFilter)) return false;
    return true;
  });

  refs.requestsCount.textContent = `${rows.length}명`;
  render(refs.requestsBody);

  if (!rows.length) {
    refs.requestsBody.appendChild(
      el("tr", null, el("td", { colSpan: 5 },
        emptyState({ title: "조건에 맞는 교사가 없습니다", desc: "필터를 바꿔 보세요." }))),
    );
    return;
  }

  for (const req of rows) {
    const dayCell = el("td");

    if (!req.days.length) {
      dayCell.appendChild(el("span", { class: "badge badge--warn" }, "미신청"));
    } else {
      const chips = el("div", { class: "chip-group" });
      for (const day of req.days) {
        chips.appendChild(
          el("button", {
            class: "chip", type: "button",
            title: `${state.month}월 ${day}일 신청 취소`,
            onClick: () => cancelDay(state, refs, req, day),
          }, `${day}일`),
        );
      }
      dayCell.appendChild(chips);
      dayCell.appendChild(
        el("div", { class: "hint", style: { marginTop: "6px" } }, `총 ${req.days.length}식`));
    }

    const reasonCell = el("td");
    const reasonEntries = Object.entries(req.reasons).sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!reasonEntries.length) {
      reasonCell.appendChild(el("span", { class: "subtle small" }, "—"));
    } else {
      const list = el("div", { class: "stack-2" });
      for (const [dayStr, reason] of reasonEntries) {
        list.appendChild(
          el("div", { class: "small" },
            el("span", { class: "badge badge--warn" }, `${dayStr}일`),
            " ", reason),
        );
      }
      reasonCell.appendChild(list);
    }

    refs.requestsBody.appendChild(
      el("tr", null,
        el("td", { class: "strong" }, req.name),
        el("td", { class: "small muted truncate" }, req.email),
        dayCell,
        reasonCell,
        el("td", { class: "small subtle" }, req.updatedAt ? formatDateTime(req.updatedAt) : "—"),
      ),
    );
  }
}

async function cancelDay(state, refs, req, day) {
  const answer = await confirmDialog({
    title: `${state.month}월 ${day}일 신청 취소`,
    message: `${req.name} 선생님의 ${state.month}월 ${day}일 급식 신청을 취소합니다.`,
    confirmText: "취소하기",
    cancelText: "그대로 두기",
    tone: "danger",
  });
  if (answer !== "confirm") return;

  try {
    await adminRemoveDay(state.year, state.month, req.docId, day);
    toast(`${day}일 신청을 취소했습니다.`, "ok");
    await load(state, refs);
  } catch (e) {
    console.error(e);
    toast(e?.message || "취소에 실패했습니다.", "danger");
  }
}

/* =========================================================
   미신청자
   ========================================================= */

function buildNonApplicantsCard(refs) {
  refs.nonApplicants = el("div", null, ...skeletonRows(2));
  return el("section", { class: "card stack" },
    sectionHead(3, "미신청 교직원",
      "교직원 명부와 대조해, 신청 화면에 한 번도 들어오지 않은 교사까지 찾아냅니다."),
    refs.nonApplicants,
  );
}

function paintNonApplicants(state, refs) {
  const { noRequest, emptyDays, usingRoster } = findNonApplicants(state.roster, state.requests);

  const blocks = [];

  if (!usingRoster) {
    blocks.push(
      el("div", { class: "banner banner--info" },
        el("span", { class: "banner__icon" }, icon("info", 16)),
        el("div", { class: "banner__body" },
          el("div", { class: "banner__title" }, "교직원 명부가 비어 있습니다"),
          el("div", { class: "banner__desc" },
            "«월 · 미실시일 설정» 탭에서 명부를 등록하면 미접속 교사까지 자동으로 대조합니다. " +
            "지금은 신청 기록이 있는 교사만 판단합니다."),
        ),
      ),
    );
  }

  const nameList = (items, tone, title, desc) => {
    if (!items.length) return null;
    return el("div", { class: "stack-2" },
      el("div", { class: "row row--tight" },
        el("span", { class: `badge badge--${tone}` }, el("i", { class: "badge__dot" }), `${items.length}명`),
        el("span", { class: "strong small" }, title)),
      el("div", { class: "hint" }, desc),
      el("div", { class: "chip-group" },
        ...items.map((m) => el("span", { class: "chip", title: m.email }, m.name))),
    );
  };

  const sections = [
    nameList(noRequest, "danger", "신청 기록 자체가 없음",
      "신청 화면에 한 번도 접속하지 않았습니다. 개별 안내가 필요합니다."),
    nameList(emptyDays, "warn", "0일로 저장함",
      "화면에는 들어왔으나 신청한 날짜가 없습니다."),
  ].filter(Boolean);

  if (!sections.length) {
    blocks.push(emptyState({
      icon: "check",
      title: "미신청 교직원이 없습니다",
      desc: usingRoster ? "명부의 모든 교직원이 신청했습니다." : "신청 기록이 있는 교사는 모두 신청했습니다.",
    }));
  } else {
    blocks.push(...sections);
  }

  render(refs.nonApplicants, el("div", { class: "stack" }, ...blocks));
}

/* =========================================================
   미신청 사유 (일자별)
   ========================================================= */

function buildReasonsCard(refs) {
  refs.reasons = el("div", null, ...skeletonRows(3));
  return el("section", { class: "card stack" },
    sectionHead(4, "일자별 미신청 사유",
      "교사가 신청 화면에서 입력한 사유입니다. 식수 조정 근거로 활용하세요."),
    refs.reasons,
  );
}

function paintReasons(state, refs) {
  const byDay = {};
  for (const req of state.requests) {
    for (const [dayStr, reason] of Object.entries(req.reasons)) {
      (byDay[dayStr] ||= []).push({ name: req.name, reason });
    }
  }

  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  if (!days.length) {
    render(refs.reasons, emptyState({
      title: "입력된 미신청 사유가 없습니다",
      desc: "교사가 신청 화면에서 사유를 남기면 여기에 모입니다.",
    }));
    return;
  }

  const wrap = el("div", { class: "stack-2" });
  for (const day of days) {
    const entries = byDay[String(day)].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    wrap.appendChild(
      el("div", { class: "day-row" },
        el("div", null,
          el("span", { class: "day-row__date" }, `${state.month}월 ${day}일`),
          el("span", { class: "day-row__dow" }, DOW_LABEL[dowOf(state.year, state.month, day)]),
        ),
        el("div", { class: "chip-group", style: { justifyContent: "flex-end", maxWidth: "70%" } },
          ...entries.map((e) =>
            el("span", { class: "chip", title: `${e.name} · ${e.reason}` },
              `${e.name} · ${e.reason}`)),
        ),
      ),
    );
  }

  render(refs.reasons, el("div", { class: "card card--flush card--inset" }, wrap));
}

/* =========================================================
   급식 추가 신청
   ========================================================= */

function buildAddCard(state, refs) {
  refs.addTeacher = el("select", { class: "select select--sm", style: { width: "240px" } },
    el("option", { value: "" }, "교사를 선택하세요"));

  refs.addDay = el("select", { class: "select select--sm", style: { width: "130px" } },
    el("option", { value: "" }, "날짜 선택"));

  const addBtn = el("button", {
    class: "btn btn--primary btn--sm", type: "button",
    onClick: async () => {
      const docId = refs.addTeacher.value;
      const day = Number(refs.addDay.value);
      if (!docId || !day) { toast("교사와 날짜를 모두 선택해 주세요.", "warn"); return; }

      const req = state.requests.find((r) => r.docId === docId);
      const answer = await confirmDialog({
        title: "급식 추가 신청",
        message: `${req?.name || "선택한 교사"} · ${state.month}월 ${day}일 급식을 추가합니다.`,
        confirmText: "추가",
      });
      if (answer !== "confirm") return;

      try {
        await adminAddDay(state.year, state.month, docId, day);
        toast("추가되었습니다.", "ok");
        await load(state, refs);
      } catch (e) {
        console.error(e);
        toast(e?.message || "추가에 실패했습니다.", "danger");
      }
    },
  }, icon("plus", 14), "추가");

  return el("section", { class: "card stack" },
    sectionHead(5, "급식 추가 신청",
      "주말과 급식 미실시일은 목록에 나타나지 않습니다."),
    el("div", { class: "row" }, refs.addTeacher, refs.addDay, addBtn),
    el("div", { class: "hint" },
      "※ 신청 화면에 한 번도 접속하지 않은 교사는 목록에 없습니다. " +
      "본인 계정으로 한 번 로그인해야 신청 문서가 생성됩니다."),
  );
}

function paintAddOptions(state, refs) {
  render(refs.addTeacher, el("option", { value: "" }, "교사를 선택하세요"));
  for (const req of state.requests) {
    refs.addTeacher.appendChild(
      el("option", { value: req.docId }, `${req.name} (${req.email})`),
    );
  }

  render(refs.addDay, el("option", { value: "" }, "날짜 선택"));
  for (const day of state.schoolDays) {
    refs.addDay.appendChild(
      el("option", { value: String(day) },
        `${day}일 (${DOW_LABEL[dowOf(state.year, state.month, day)]})`),
    );
  }

  render(refs.daySelect, el("option", { value: "" }, "날짜 전체"));
  for (const day of state.schoolDays) {
    refs.daySelect.appendChild(el("option", { value: String(day) }, `${day}일`));
  }
  refs.daySelect.value = state.dayFilter || "";
}

/* =========================================================
   로딩
   ========================================================= */

async function load(state, refs) {
  const myToken = token.next();
  render(refs.requestsBody, el("tr", null, el("td", { colSpan: 5 }, ...skeletonRows(4))));

  try {
    // 컬렉션 읽기는 1회만 — v1 은 같은 데이터를 3번 읽었습니다.
    const [requests, blockedDoc, roster] = await Promise.all([
      listMonthRequests(state.year, state.month),
      getBlocked(state.year, state.month),
      getRosterSafe(),
    ]);

    if (token.isStale(myToken)) return;

    state.requests = requests;
    state.roster = roster;
    state.blocked = blockedDoc.days;
    state.schoolDays = getSchoolDays(state.year, state.month, state.blocked);

    paintAddOptions(state, refs);
    paintStats(state, refs);
    paintRequests(state, refs);
    paintNonApplicants(state, refs);
    paintReasons(state, refs);
  } catch (e) {
    console.error("[teachers] 로딩 실패:", e);
    if (token.isStale(myToken)) return;
    toast("데이터를 불러오지 못했습니다.", "danger");
    render(refs.requestsBody,
      el("tr", null, el("td", { colSpan: 5 },
        emptyState({ icon: "alert", title: "불러오기 실패", desc: e?.message || "" }))));
  }
}
