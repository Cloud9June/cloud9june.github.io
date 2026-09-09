/* ============================================================
   admin.js — 선생님용 관리 콘솔 (PC 화면)

   명부·권한 편집은 총관리자만, 피드 관리는 관리자 이상.
   화면에서 막는 것과 별개로 firestore.rules 가 서버에서 다시 막습니다.
   ============================================================ */
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
  query, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "./firebase.js";
import * as A from "./auth.js";
import * as DB from "./db.js";
import { PRESET_TAGS, PRIV, APP_VERSION } from "./config.js";
import { el, fmtWhen } from "./render.js";
import { toast, openSheet, closeSheet, initSheet, askConfirm, initTheme } from "./ui.js";

const $ = (id) => document.getElementById(id);
const ROLES = ["학생", "교사"];
const PRIV_LIST = [PRIV.SUPER, PRIV.ADMIN, PRIV.HOMEROOM, PRIV.LEAD, PRIV.SUBLEAD];

const state = { view: "roster", users: [], filter: "", classFilter: "", feeds: {} };

/* ── 시작 ──────────────────────────────────────────────── */
initTheme();
initSheet();
$("loginBtn").addEventListener("click", login);
$("logoutBtn").addEventListener("click", async () => { await A.leave(); location.reload(); });
$("side").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) switchView(b.dataset.view);
});

A.watchSession(({ status, reason }) => {
  if (status !== "in") {
    show(false);
    if (reason === "NOT_REGISTERED") $("gateMsg").textContent = "명부에 등록되지 않은 계정입니다.";
    if (reason === "SCHOOL_ONLY") $("gateMsg").textContent = "학교 계정으로만 접속할 수 있습니다.";
    return;
  }
  if (!A.isAdmin()) {
    show(false);
    $("gateMsg").textContent = "관리자 권한이 없는 계정입니다. 교육정보부로 문의해 주세요.";
    return;
  }
  show(true);
  $("whoami").textContent = A.displayName();
  switchView("roster");
});

async function login() {
  try { await A.signIn(); }
  catch (err) {
    const msg = A.loginErrorMessage(err);
    if (msg) {
      console.error("[로그인 실패]", err?.code, err);
      toast(msg, "bad", 6000);
    }
  }
}

function show(on) {
  $("console").hidden = !on;
  $("gate").hidden = on;
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === view));
  if (view === "roster") viewRoster();
  else if (view === "classes") viewClasses();
  else viewFeeds(view);
}

const work = () => $("work");
const setWork = (...nodes) => { const w = work(); w.textContent = ""; w.append(...nodes); };
const head = (title, lead) => el("div", {}, el("h2", { text: title }), el("p", { class: "lead", text: lead }));

/* ══ 1. 명부 · 권한 ═══════════════════════════════════════ */
async function viewRoster() {
  setWork(head("명부 · 권한", "학생과 선생님 정보, 권한을 관리합니다. 여기 등록된 계정만 로그인할 수 있습니다."),
    el("p", { class: "lead", text: "불러오는 중…" }));

  try {
    const snap = await getDocs(collection(db, "users"));
    state.users = snap.docs.map((d) => ({ email: d.id, ...d.data() }))
      .sort(byClassThenNumber);
  } catch (err) {
    console.error(err);
    setWork(head("명부 · 권한", ""), el("p", { class: "lead", text: "명부를 불러오지 못했습니다. 권한을 확인해 주세요." }));
    return;
  }
  paintRoster();
}

const byClassThenNumber = (a, b) =>
  String(a.classKey || "zz").localeCompare(String(b.classKey || "zz"), "ko")
  || (Number(a.number) || 0) - (Number(b.number) || 0);

function paintRoster() {
  const canEdit = A.isSuper();
  const classes = [...new Set(state.users.map((u) => u.classKey).filter(Boolean))].sort();

  const search = el("input", {
    class: "search", type: "search", placeholder: "이름 · 이메일 · 번호로 검색",
    value: state.filter,
  });
  search.addEventListener("input", () => { state.filter = search.value.trim(); paintTable(); });

  const classSel = el("select", { class: "select", "aria-label": "반 선택" },
    el("option", { value: "", text: "전체 반" }),
    classes.map((c) => el("option", { value: c, text: `${c.replace("-", "학년 ")}반`, selected: state.classFilter === c })));
  classSel.addEventListener("change", () => { state.classFilter = classSel.value; paintTable(); });

  const stats = el("div", { class: "stat-row" },
    stat(state.users.length, "전체 인원"),
    stat(state.users.filter((u) => u.role === "교사").length, "선생님"),
    stat(state.users.filter((u) => u.role !== "교사").length, "학생"),
    stat(classes.length, "학급"));

  const bar = el("div", { class: "toolbar" },
    el("div", { class: "grow" }, search), classSel,
    canEdit ? el("button", { class: "btn btn--line btn--sm", type: "button", text: "＋ 한 명 추가", onclick: () => editUser(null) }) : null,
    canEdit ? el("button", { class: "btn btn--primary btn--sm", type: "button", text: "일괄 등록", onclick: bulkImport }) : null);

  const wrap = el("div", { class: "tablewrap", id: "rosterTable" });

  setWork(
    head("명부 · 권한", canEdit
      ? "여기 등록된 계정만 로그인할 수 있습니다. 학년 초에 일괄 등록으로 한 번에 올릴 수 있습니다."
      : "열람만 가능합니다. 수정은 총관리자에게 요청해 주세요."),
    stats, bar, wrap);
  paintTable();
}

const stat = (n, label) => el("div", { class: "stat" }, el("b", { text: String(n) }), el("span", { text: label }));

function paintTable() {
  const wrap = $("rosterTable");
  if (!wrap) return;
  const canEdit = A.isSuper();
  const q = state.filter.toLowerCase();

  const rows = state.users.filter((u) => {
    if (state.classFilter && u.classKey !== state.classFilter) return false;
    if (!q) return true;
    return [u.name, u.email, u.number, u.classKey].join(" ").toLowerCase().includes(q);
  });

  const table = el("table", {},
    el("thead", {}, el("tr", {},
      ["이름", "학년·반", "번호", "역할", "권한", "이메일", ""].map((h) =>
        el("th", { text: h })))),
    el("tbody", {}, rows.map((u) => el("tr", {},
      el("td", { text: u.name || "—" }),
      el("td", { class: "num-c", text: u.classKey ? u.classKey.replace("-", "학년 ") + "반" : "—" }),
      el("td", { class: "num-c", text: u.number ?? "—" }),
      el("td", { text: u.role || "학생" }),
      el("td", {}, (Array.isArray(u.privilege) ? u.privilege : []).map((p) =>
        el("span", { class: "badge badge--soft", text: p }))),
      el("td", { class: "num-c", text: u.email }),
      el("td", { class: "actions" },
        canEdit ? el("button", { class: "btn btn--line btn--sm", type: "button", text: "수정", onclick: () => editUser(u) }) : null)))));

  wrap.textContent = "";
  wrap.append(rows.length ? table : el("p", { style: "padding:28px;text-align:center;color:var(--muted)", text: "조건에 맞는 사람이 없습니다." }));
}

/* 한 명 추가 / 수정 */
function editUser(u) {
  const isNew = !u;
  const f = {
    email: input("이메일", u?.email ?? "", { type: "email", placeholder: "id@sungil-i.kr", disabled: !isNew }),
    name: input("이름", u?.name ?? ""),
    grade: input("학년", u?.grade ?? "", { type: "number", min: "1", max: "3" }),
    class: input("반", u?.class ?? "", { type: "number", min: "1", max: "12" }),
    number: input("번호", u?.number ?? "", { type: "number", min: "1", max: "60" }),
  };
  const role = el("select", { class: "select", style: "width:100%" },
    ROLES.map((r) => el("option", { value: r, text: r, selected: (u?.role ?? "학생") === r })));

  const picked = new Set(Array.isArray(u?.privilege) ? u.privilege : []);
  const chips = el("div", { class: "suggest" },
    PRIV_LIST.map((p) => {
      const c = el("button", { class: "chip" + (picked.has(p) ? " is-on" : ""), type: "button", text: p });
      c.addEventListener("click", () => {
        picked.has(p) ? picked.delete(p) : picked.add(p);
        c.classList.toggle("is-on");
      });
      return c;
    }));

  const save = el("button", { class: "btn btn--primary", type: "button", text: isNew ? "등록" : "저장" });
  const body = el("div", {},
    f.email.wrap, f.name.wrap,
    el("div", { class: "field" }, el("label", { text: "역할" }), role),
    el("div", { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:10px" },
      f.grade.wrap, f.class.wrap, f.number.wrap),
    el("div", { class: "field" }, el("label", { text: "권한" }), chips),
    el("div", { class: "sheet__actions" },
      !isNew ? el("button", {
        class: "btn btn--danger", type: "button", text: "삭제",
        onclick: async () => {
          const ok = await askConfirm({ title: "명부에서 삭제할까요?", message: `${u.name} (${u.email}) 계정은 더 이상 로그인할 수 없게 됩니다.`, okLabel: "삭제", danger: true });
          if (!ok) return;
          try { await deleteDoc(doc(db, "users", u.email)); toast("삭제했어요"); viewRoster(); }
          catch { toast("삭제하지 못했습니다.", "bad"); }
        },
      }) : null,
      el("button", { class: "btn btn--ghost", type: "button", text: "취소", onclick: closeSheet }),
      save));

  save.addEventListener("click", async () => {
    const email = f.email.node.value.trim().toLowerCase();
    const name = f.name.node.value.trim();
    if (!email.endsWith("@sungil-i.kr")) { toast("@sungil-i.kr 이메일만 등록할 수 있습니다.", "bad"); return; }
    if (!name) { toast("이름을 입력해 주세요.", "bad"); return; }

    const grade = int(f.grade.node.value);
    const klass = int(f.class.node.value);
    const payload = clean({
      name,
      role: role.value,
      grade, class: klass,
      classKey: grade && klass ? `${grade}-${klass}` : null,
      number: int(f.number.node.value),
      privilege: [...picked],
      updatedAt: serverTimestamp(),
    });

    save.disabled = true;
    try {
      await setDoc(doc(db, "users", email), payload);
      toast(isNew ? "등록했어요" : "저장했어요");
      closeSheet();
      viewRoster();
    } catch (err) {
      console.error(err);
      save.disabled = false;
      toast("저장하지 못했습니다. 총관리자 권한이 필요합니다.", "bad");
    }
  });

  openSheet(isNew ? "명부에 추가" : `${u.name} 정보 수정`, body);
}

/* 일괄 등록 */
function bulkImport() {
  const ta = el("textarea", {
    class: "textarea", style: "min-height:200px;font-family:'IBM Plex Mono',monospace;font-size:13px",
    placeholder:
`이메일, 이름, 역할, 학년, 반, 번호, 권한
2601001@sungil-i.kr, 김서준, 학생, 2, 3, 1,
2601002@sungil-i.kr, 이지우, 학생, 2, 3, 2, 반장
kim@sungil-i.kr, 김형준, 교사, 2, 3, , 담임|관리자`,
  });

  const run = el("button", { class: "btn btn--primary", type: "button", text: "등록하기" });
  const body = el("div", {},
    el("p", { class: "lead", text: "구글 시트에서 복사해 붙여넣으세요. 쉼표 또는 탭으로 구분합니다. 권한이 여러 개면 | 로 나눕니다. 첫 줄이 머리글이면 자동으로 건너뜁니다." }),
    ta,
    el("div", { class: "sheet__actions" },
      el("button", { class: "btn btn--ghost", type: "button", text: "취소", onclick: closeSheet }),
      run));

  run.addEventListener("click", async () => {
    const rows = parseRows(ta.value);
    if (!rows.length) { toast("읽을 수 있는 줄이 없습니다.", "bad"); return; }

    const ok = await askConfirm({
      title: `${rows.length}명을 등록할까요?`,
      message: "같은 이메일이 이미 있으면 덮어씁니다.",
      okLabel: "등록",
    });
    if (!ok) return;

    run.disabled = true;
    run.textContent = "등록 중…";
    try {
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        for (const r of rows.slice(i, i + 400)) {
          batch.set(doc(db, "users", r.email), r.data);
        }
        await batch.commit();
      }
      toast(`${rows.length}명을 등록했어요`);
      closeSheet();
      viewRoster();
    } catch (err) {
      console.error(err);
      run.disabled = false;
      run.textContent = "등록하기";
      toast("등록에 실패했습니다. 형식과 권한을 확인해 주세요.", "bad");
    }
  });

  openSheet("명부 일괄 등록", body);
}

function parseRows(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const cells = line.split(/\t|,/).map((c) => c.trim());
    const email = (cells[0] || "").toLowerCase();
    if (!email.endsWith("@sungil-i.kr")) continue;   // 머리글·빈 줄 자동 제외
    const grade = int(cells[3]);
    const klass = int(cells[4]);
    out.push({
      email,
      data: clean({
        name: cells[1] || "이름 없음",
        role: cells[2] === "교사" ? "교사" : "학생",
        grade, class: klass,
        classKey: grade && klass ? `${grade}-${klass}` : null,
        number: int(cells[5]),
        privilege: (cells[6] || "").split("|").map((p) => p.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      }),
    });
  }
  return out;
}

/* ══ 2. 전체 / 대외 피드 ══════════════════════════════════ */
async function viewFeeds(tab) {
  const label = tab === "all" ? "전체 피드" : "대외 피드";
  setWork(head(label, tab === "all"
    ? "학교 전체에 나가는 공지입니다."
    : "로그인하지 않은 사람도 볼 수 있는 소식입니다."),
    el("p", { class: "lead", text: "불러오는 중…" }));

  let items = [];
  try {
    const snap = await getDocs(query(DB.colRef(tab), orderBy("createdAt", "desc"), limit(60)));
    items = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() ?? null }));
  } catch (err) {
    console.error(err);
    setWork(head(label, ""), el("p", { class: "lead", text: "불러오지 못했습니다." }));
    return;
  }

  const list = el("div", {}, items.length
    ? items.map((f) => feedRow(tab, f))
    : el("p", { class: "lead", text: "등록된 글이 없습니다." }));

  setWork(head(label, tab === "all" ? "학교 전체에 나가는 공지입니다." : "로그인하지 않은 사람도 볼 수 있는 소식입니다."),
    el("div", { class: "toolbar" },
      el("button", { class: "btn btn--primary btn--sm", type: "button", text: "＋ 새 글 쓰기", onclick: () => feedEditor(tab, null) }),
      el("span", { class: "lead", style: "margin:0", text: `최근 ${items.length}건` })),
    list);
}

function feedRow(tab, f) {
  return el("div", { class: "admin-card" },
    el("h3", { text: f.title || "(제목 없음)" }),
    el("div", { class: "meta", text: `${f.authorName || "작성자 미상"} · ${fmtWhen(f.createdAt)}` }),
    el("div", { class: "body", text: (f.content || "").slice(0, 300) }),
    Array.isArray(f.tags) && f.tags.length
      ? el("div", { class: "card__tags" }, f.tags.map((t) => el("span", { class: "tag", text: t })))
      : null,
    el("div", { class: "foot" },
      el("div", { class: "grow" }),
      el("button", { class: "btn btn--line btn--sm", type: "button", text: "수정", onclick: () => feedEditor(tab, f) }),
      el("button", {
        class: "btn btn--danger btn--sm", type: "button", text: "삭제",
        onclick: async () => {
          const ok = await askConfirm({ title: "이 글을 삭제할까요?", message: f.title, okLabel: "삭제", danger: true });
          if (!ok) return;
          try { await DB.removeFeed({ tab, id: f.id }); toast("삭제했어요"); viewFeeds(tab); }
          catch { toast("삭제하지 못했습니다.", "bad"); }
        },
      })));
}

function feedEditor(tab, f) {
  const isNew = !f;
  const title = el("input", { class: "input", type: "text", maxlength: "100", placeholder: "제목", value: f?.title ?? "" });
  const content = el("textarea", { class: "textarea", maxlength: "3000", placeholder: "내용" });
  content.value = f?.content ?? "";

  const picked = new Set(Array.isArray(f?.tags) ? f.tags : []);
  const chips = tab === "all"
    ? el("div", { class: "suggest" }, PRESET_TAGS.map((t) => {
        const c = el("button", { class: "chip" + (picked.has(t) ? " is-on" : ""), type: "button", text: t });
        c.addEventListener("click", () => { picked.has(t) ? picked.delete(t) : picked.add(t); c.classList.toggle("is-on"); });
        return c;
      }))
    : null;

  const save = el("button", { class: "btn btn--primary", type: "button", text: isNew ? "등록" : "수정 완료" });
  const body = el("div", {},
    el("div", { class: "field" }, el("label", { text: "제목" }), title),
    el("div", { class: "field" }, el("label", { text: "내용" }), content),
    chips ? el("div", { class: "field" }, el("label", { text: "공개대상" }), chips) : null,
    el("div", { class: "sheet__actions" },
      el("button", { class: "btn btn--ghost", type: "button", text: "취소", onclick: closeSheet }),
      save));

  save.addEventListener("click", async () => {
    const t = title.value.trim(), c = content.value.trim();
    if (!t || !c) { toast("제목과 내용을 입력해 주세요.", "bad"); return; }
    save.disabled = true;
    try {
      if (isNew) await DB.createFeed({ tab, title: t, content: c, tags: [...picked], me: A.session.profile });
      else await DB.editFeed({ tab, id: f.id, title: t, content: c, tags: [...picked] });
      toast(isNew ? "등록했어요" : "수정했어요");
      closeSheet();
      viewFeeds(tab);
    } catch (err) {
      console.error(err);
      save.disabled = false;
      toast("저장하지 못했습니다.", "bad");
    }
  });

  openSheet(isNew ? "새 글 쓰기" : "글 수정", body);
}

/* ══ 3. 반별 확인 현황 ════════════════════════════════════ */
async function viewClasses() {
  if (!state.users.length) {
    try {
      const snap = await getDocs(collection(db, "users"));
      state.users = snap.docs.map((d) => ({ email: d.id, ...d.data() })).sort(byClassThenNumber);
    } catch { /* 무시 */ }
  }
  const classes = [...new Set(state.users.map((u) => u.classKey).filter(Boolean))].sort();

  const sel = el("select", { class: "select", "aria-label": "반 선택" },
    el("option", { value: "", text: "반을 선택하세요" }),
    classes.map((c) => el("option", { value: c, text: `${c.replace("-", "학년 ")}반` })));

  const box = el("div", { id: "classBox" });
  sel.addEventListener("change", () => loadClassStatus(sel.value, box));

  setWork(head("반별 확인 현황", "중요 알림을 아직 확인하지 않은 학생을 볼 수 있습니다."),
    el("div", { class: "toolbar" }, sel), box);
}

async function loadClassStatus(classKey, box) {
  box.textContent = "";
  if (!classKey) return;
  box.append(el("p", { class: "lead", text: "불러오는 중…" }));

  try {
    const { items } = await DB.listFeeds({ tab: "class", classKey, pageSize: 40 });
    const important = items.filter((f) => f.important);
    const size = state.users.filter((u) => u.classKey === classKey && u.role !== "교사").length;

    box.textContent = "";
    box.append(el("div", { class: "stat-row" },
      stat(size, "반 인원"),
      stat(important.length, "중요 알림"),
      stat(important.filter((f) => f.students.length === 0).length, "모두 확인함")));

    if (!important.length) {
      box.append(el("p", { class: "lead", text: "중요 알림이 없습니다." }));
      return;
    }

    for (const f of important) {
      const done = Math.max(0, size - f.students.length);
      box.append(el("div", { class: "admin-card" },
        el("h3", { text: f.title }),
        el("div", { class: "meta", text: `${f.authorName} · ${fmtWhen(f.createdAt)} · ${done}/${size} 확인` }),
        f.students.length
          ? el("div", { class: "confirm__nums", style: "margin-top:10px" },
              f.students.map((n) => el("span", { class: "num", text: String(n) })))
          : el("div", { style: "margin-top:10px" },
              el("span", { class: "badge badge--done", text: "모두 확인함" }))));
    }
  } catch (err) {
    console.error(err);
    box.textContent = "";
    box.append(el("p", { class: "lead", text: "불러오지 못했습니다." }));
  }
}

/* ── 작은 헬퍼 ─────────────────────────────────────────── */
function input(label, value, attrs = {}) {
  const node = el("input", { class: "input", type: "text", value: value ?? "", ...attrs });
  const wrap = el("div", { class: "field" }, el("label", { text: label }), node);
  return { node, wrap };
}
const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
/** null 값을 빼고 보냅니다 (규칙의 키 검사를 통과시키기 위해) */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

console.info(`S:NOW 관리 콘솔 v${APP_VERSION}`);
