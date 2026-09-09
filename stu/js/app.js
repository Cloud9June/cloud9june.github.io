/* ============================================================
   app.js — 진입점. 화면 전환과 이벤트를 여기서 묶습니다.
   ============================================================ */
import { TABS, PRESET_TAGS, HELP, PAGE_SIZE, APP_VERSION } from "./config.js";
import * as A from "./auth.js";
import * as DB from "./db.js";
import { el, feedCard, skeletons, emptyState, todayLabel } from "./render.js";
import { showRegister } from "./register.js";
import {
  toast, openSheet, closeSheet, initSheet, askConfirm, openActions,
  initTheme, initPullToRefresh, safeGet, safeSet,
} from "./ui.js";

/* ── 상태 ──────────────────────────────────────────────── */
const state = {
  tab: "all",
  items:  { all: [], class: [], external: [] },
  cursor: { all: null, class: null, external: null },
  done:   { all: false, class: false, external: false },
  loaded: { all: false, class: false, external: false },
  busy:   false,
  filter: null,      // 선택된 태그
  classSize: null,   // 우리 반 인원 (아는 경우에만)
};

const isKiosk = new URLSearchParams(location.search).get("kiosk") === "true";
const $ = (id) => document.getElementById(id);

/* ── 시작 ──────────────────────────────────────────────── */
boot();

function boot() {
  initTheme();
  initSheet();
  if (isKiosk) document.body.classList.add("kiosk");

  $("loginBtn").addEventListener("click", doLogin);
  $("guestBtn").addEventListener("click", doGuest);
  $("writeBtn").addEventListener("click", () => openEditor(null));
  $("tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-go]");
    if (btn) go(btn.dataset.go);
  });

  initPullToRefresh(() => refresh(true));
  registerServiceWorker();

  A.watchSession(onSession);
}

/* ── 세션 변화 ─────────────────────────────────────────── */
function onSession({ status, reason }) {
  if (status === "in") {
    showApp();
    return;
  }
  if (status === "register") {          // 명부에 없는 학교 계정 → 본인 등록
    showRegister(A.session.user);
    return;
  }
  if (status === "guest" || (status === "out" && A.wasGuest() && !reason)) {
    A.enterGuest();
    showApp();
    return;
  }

  showGate();
  if (reason === "SCHOOL_ONLY") toast("학교 계정(@sungil-i.kr)으로만 로그인할 수 있습니다.", "bad", 4000);
  if (reason === "NOT_REGISTERED") toast("명부에 등록되지 않은 계정입니다. 교육정보부로 문의해 주세요.", "bad", 5000);
  if (reason === "PROFILE_FAIL") toast("정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "bad", 4000);
}

async function doLogin() {
  $("gateSpinner").classList.add("is-on");
  $("loginBtn").disabled = true;
  $("guestBtn").disabled = true;
  try {
    A.exitGuest();
    await A.signIn();               // 이후는 watchSession 이 이어받습니다
  } catch (err) {
    const msg = A.loginErrorMessage(err);
    if (msg) {
      console.error("[로그인 실패]", err?.code, err);
      toast(msg, "bad", 6000);
    }
  } finally {
    $("gateSpinner").classList.remove("is-on");
    $("loginBtn").disabled = false;
    $("guestBtn").disabled = false;
  }
}

function doGuest() {
  A.enterGuest();
  showApp();
}

/* ── 화면 전환 ─────────────────────────────────────────── */
function showGate() {
  $("app").classList.remove("is-ready");
  $("reg").hidden = true;
  $("gate").hidden = false;
  const v = $("gateVideo");
  if (v && !v.src) {                      // 배경 영상은 있으면 틀고 없으면 조용히 넘어갑니다
    v.src = "/stu/video/intro2.mp4";
    v.play().catch(() => {});
  }
}

function showApp() {
  $("gate").hidden = true;
  $("reg").hidden = true;
  $("app").classList.add("is-ready");

  const who = $("whoami");
  who.hidden = false;
  who.textContent = A.session.guest ? "게스트" : A.displayName();

  // 게스트와 학급 없는 사용자는 볼 수 없는 탭을 숨깁니다
  toggleTab("all", A.canView("all"));
  toggleTab("class", A.canView("class"));

  const start = A.canView("all") ? (safeGet("snow.tab") || "all") : "external";
  go(A.canView(start) ? start : "external", true);
}

const toggleTab = (name, on) => {
  const b = document.querySelector(`[data-go="${name}"]`);
  if (b) b.hidden = !on;
};

/* ── 탭 이동 ───────────────────────────────────────────── */
function go(tab, force = false) {
  if (!force && tab === state.tab) { scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (!A.canView(tab)) { toast("접근 권한이 없는 화면입니다.", "bad"); return; }

  state.tab = tab;
  state.filter = null;
  safeSet("snow.tab", tab);

  document.documentElement.setAttribute("data-tab", tab);
  document.querySelectorAll("[data-go]").forEach((b) => {
    const on = b.dataset.go === tab;
    b.classList.toggle("is-active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });

  $("writeBtn").classList.toggle("is-on", tab !== "more" && A.canWrite(tab));
  scrollTo({ top: 0 });
  paintScreen();
}

/* ── 화면 그리기 ───────────────────────────────────────── */
function paintScreen() {
  const host = $("screen");
  host.textContent = "";

  if (state.tab === "more") { host.append(moreScreen()); return; }

  const meta = TABS[state.tab];
  host.append(el("div", { class: "screen-head" },
    el("div", { class: "eyebrow", text: state.tab === "all" ? todayLabel() : meta.sub }),
    el("h1", {}, meta.title, el("span", { text: "." }))));

  if (A.session.guest) host.append(guestNotice());
  if (A.isPending() && state.tab !== "more") host.append(pendingBanner());

  if (state.tab === "all") host.append(filterRow());

  const feed = el("section", { class: "feed", id: "feedList", "aria-live": "polite" });
  host.append(feed);

  if (!state.loaded[state.tab]) {
    feed.append(...skeletons(3));
    loadPage(true);
  } else {
    paintFeed();
  }
}

function guestNotice() {
  return el("div", { class: "notice" },
    el("span", { text: "게스트로 보는 중입니다" }),
    el("button", {
      type: "button", text: "로그인",
      onclick: () => { A.exitGuest(); showGate(); },
    }));
}

function pendingBanner() {
  return el("div", { class: "pending-banner" },
    el("b", { text: "승인 대기 중입니다" }),
    el("span", { text: "교육정보부에서 선생님 계정을 승인하면 우리반 기능과 글쓰기가 열립니다. 그전에도 전체·대외 공지는 보실 수 있습니다." }));
}

function filterRow() {
  const row = el("div", { class: "filters", role: "group", "aria-label": "공개대상 태그" });
  const used = new Set(state.items.all.flatMap((f) => f.tags));
  const tags = PRESET_TAGS.filter((t) => used.has(t));

  row.append(chip("전체 보기", state.filter === null, () => { state.filter = null; paintScreen(); }));
  for (const t of tags) {
    row.append(chip(t, state.filter === t, () => { state.filter = t; paintScreen(); }));
  }
  return row;
}

const chip = (label, on, run) => el("button", {
  class: "chip" + (on ? " is-on" : ""), type: "button", text: label, onclick: run,
});

function paintFeed() {
  const feed = $("feedList");
  if (!feed) return;
  feed.textContent = "";

  let items = state.items[state.tab];
  if (state.tab === "all" && state.filter) {
    items = items.filter((f) => f.tags.includes(state.filter));
  }

  if (!items.length) {
    feed.append(emptyStateFor());
    return;
  }

  const ctx = cardContext();
  for (const f of items) feed.append(feedCard(f, ctx));

  if (!state.done[state.tab] && !state.filter) feed.append(sentinel());
}

function emptyStateFor() {
  if (state.filter) return emptyState("🔍", "이 태그의 글이 없어요", "다른 태그를 눌러 보세요.");
  if (state.tab === "class") return emptyState("🌤", "우리 반 알림이 없어요", "담임 선생님이나 반장이 글을 올리면 여기에 보입니다.");
  if (state.tab === "external") return emptyState("📭", "대외 소식이 없어요", "새 소식이 올라오면 알려 드릴게요.");
  return emptyState("📭", "아직 공지가 없어요", "화면을 아래로 당기면 새로고침됩니다.");
}

function cardContext() {
  const tab = state.tab;
  return {
    tab,
    canManage: A.canManage(tab),
    canSeeRoster: A.isTeacher() || A.isHomeroom() || A.isClassLead() || A.isAdmin(),
    isStudent: A.isStudent(),
    myNumber: A.myNumber(),
    classSize: state.classSize,
    onMenu: cardMenu,
    onConfirm: confirmRead,
  };
}

/* ── 무한 스크롤 ───────────────────────────────────────── */
function sentinel() {
  const node = el("div", { style: "height:1px" });
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadPage(false); }
  }, { rootMargin: "320px" });
  io.observe(node);
  return node;
}

/* ── 데이터 ────────────────────────────────────────────── */
async function loadPage(initial) {
  const tab = state.tab;
  if (state.busy || (state.done[tab] && !initial)) return;
  state.busy = true;

  try {
    const { items, cursor, done } = await DB.listFeeds({
      tab,
      classKey: A.myClassKey(),
      cursor: initial ? null : state.cursor[tab],
      pageSize: PAGE_SIZE,
    });

    state.items[tab] = initial ? items : dedupe([...state.items[tab], ...items]);
    state.cursor[tab] = cursor;
    state.done[tab] = done;
    state.loaded[tab] = true;

    if (tab === "class" && initial) {
      updateClassDot();
      // 반 인원은 진행 막대에만 쓰이므로 화면을 막지 않고, 알게 되면 그때 다시 그립니다.
      if (A.canWrite("class") && state.classSize === null) {
        loadClassSize().then(() => { if (state.tab === "class") paintFeed(); });
      }
    }
    if (state.tab === tab) paintScreen();
  } catch (err) {
    console.error("[feed] 불러오기 실패", err);
    state.loaded[tab] = true;
    if (state.tab === tab) {
      const feed = $("feedList");
      if (feed) {
        feed.textContent = "";
        feed.append(emptyState("⚠️", "불러오지 못했어요",
          err?.code === "permission-denied"
            ? "이 화면을 볼 권한이 없습니다. 교육정보부로 문의해 주세요."
            : "네트워크를 확인한 뒤 화면을 아래로 당겨 주세요."));
      }
    }
  } finally {
    state.busy = false;
  }
}

const dedupe = (list) => [...new Map(list.map((f) => [f.id, f])).values()];

async function refresh(showToast = false) {
  state.loaded[state.tab] = false;
  state.cursor[state.tab] = null;
  state.done[state.tab] = false;
  await loadPage(true);
  if (showToast) toast("새로고침했어요");
}

async function loadClassSize() {
  try {
    const nums = await DB.listClassNumbers(A.myClassKey());
    state.classSize = nums.length || null;
  } catch { state.classSize = null; }
}

function updateClassDot() {
  const me = A.myNumber();
  const unread = A.isStudent() && me !== null
    && state.items.class.some((f) => f.important && f.students.includes(me));
  $("classDot").hidden = !unread;
}

/* ── 중요 알림 확인 ────────────────────────────────────── */
async function confirmRead(feed, btn) {
  const me = A.myNumber();
  if (me === null) return;
  btn.disabled = true;
  btn.textContent = "처리 중…";
  try {
    await DB.confirmRead({ classKey: A.myClassKey(), id: feed.id, number: me });
    feed.students = feed.students.filter((n) => n !== me);
    toast("확인했어요");
    updateClassDot();
    paintFeed();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = "확인했어요";
    toast("처리하지 못했습니다. 다시 시도해 주세요.", "bad");
  }
}

/* ── 카드 메뉴 ─────────────────────────────────────────── */
function cardMenu(feed) {
  openActions(feed.title, [
    { icon: "✏️", label: "수정하기", run: () => openEditor(feed) },
    {
      icon: "🗑", label: "삭제하기", danger: true,
      run: async () => {
        const ok = await askConfirm({
          title: "이 글을 삭제할까요?",
          message: "삭제한 글은 되돌릴 수 없습니다.",
          okLabel: "삭제", danger: true,
        });
        if (!ok) return;
        try {
          await DB.removeFeed({ tab: state.tab, classKey: A.myClassKey(), id: feed.id });
          state.items[state.tab] = state.items[state.tab].filter((f) => f.id !== feed.id);
          paintFeed();
          toast("삭제했어요");
        } catch (err) {
          console.error(err);
          toast("삭제하지 못했습니다.", "bad");
        }
      },
    },
  ]);
}

/* ── 글쓰기 / 수정 ─────────────────────────────────────── */
function openEditor(feed) {
  const tab = state.tab;
  const editing = !!feed;

  const title = el("input", {
    class: "input", id: "fTitle", type: "text",
    placeholder: "제목", maxlength: "100", value: feed?.title ?? "",
  });
  const content = el("textarea", {
    class: "textarea", id: "fContent",
    placeholder: "내용을 입력하세요", maxlength: "3000",
  });
  content.value = feed?.content ?? "";

  const form = el("div", {},
    el("div", { class: "field" }, el("label", { for: "fTitle", text: "제목" }), title),
    el("div", { class: "field" }, el("label", { for: "fContent", text: "내용" }), content));

  /* 전체 탭 — 공개대상 태그 */
  let picked = new Set(feed?.tags ?? []);
  if (tab === "all") {
    const chips = el("div", { class: "suggest" });
    for (const t of PRESET_TAGS) {
      const c = chip(t, picked.has(t), () => {
        picked.has(t) ? picked.delete(t) : picked.add(t);
        c.classList.toggle("is-on");
      });
      chips.append(c);
    }
    form.append(el("div", { class: "field" },
      el("label", { text: "공개대상 (선택)" }), chips));
  }

  /* 우리반 탭 — 중요 알림 */
  let importantBox = null;
  if (tab === "class") {
    importantBox = el("input", { type: "checkbox", id: "fImportant" });
    if (feed?.important) importantBox.checked = true;
    form.append(el("label", { class: "switch", for: "fImportant" },
      importantBox,
      el("div", {},
        el("span", { text: "중요 알림으로 보내기" }),
        el("small", { text: "반 전체 번호가 붙고, 학생이 확인하면 하나씩 사라집니다." }))));
  }

  const submit = el("button", {
    class: "btn btn--primary", type: "button", text: editing ? "수정 완료" : "등록",
  });
  form.append(el("div", { class: "sheet__actions" },
    el("button", { class: "btn btn--ghost", type: "button", text: "취소", onclick: closeSheet }),
    submit));

  submit.addEventListener("click", async () => {
    const t = title.value.trim();
    const c = content.value.trim();
    if (!t || !c) { toast("제목과 내용을 모두 입력해 주세요.", "bad"); return; }

    submit.disabled = true;
    submit.textContent = editing ? "수정 중…" : "등록 중…";
    try {
      const important = !!importantBox?.checked;
      let students = [];
      if (tab === "class" && important) {
        students = await DB.listClassNumbers(A.myClassKey());
        if (!students.length) toast("반 명부를 찾지 못해 번호 없이 등록합니다.", "bad", 3200);
      }

      if (editing) {
        await DB.editFeed({
          tab, classKey: A.myClassKey(), id: feed.id,
          title: t, content: c, tags: [...picked],
          important: tab === "class" ? important : undefined,
          students,
        });
        toast("수정했어요");
      } else {
        await DB.createFeed({
          tab, classKey: A.myClassKey(),
          title: t, content: c, tags: [...picked],
          important, students, me: A.session.profile,
        });
        toast("등록했어요");
      }
      closeSheet();
      await refresh();
    } catch (err) {
      console.error(err);
      submit.disabled = false;
      submit.textContent = editing ? "수정 완료" : "등록";
      toast(err?.code === "permission-denied"
        ? "이 글을 쓸 권한이 없습니다."
        : "저장하지 못했습니다. 다시 시도해 주세요.", "bad");
    }
  });

  openSheet(editing ? "글 수정" : `${TABS[tab].title} 글쓰기`, form);
}

/* ── 더보기 화면 ───────────────────────────────────────── */
function moreScreen() {
  const wrap = el("div", {});
  wrap.append(el("div", { class: "screen-head" },
    el("div", { class: "eyebrow", text: TABS.more.sub }),
    el("h1", {}, "더보기", el("span", { text: "." }))));

  const stack = el("div", { class: "stack" });

  /* 내 정보 */
  const p = A.session.profile;
  stack.append(el("div", { class: "me" },
    el("div", { class: "me__mark", text: A.initials() }),
    el("div", {},
      el("div", { class: "me__name", text: p ? p.name : "게스트" }),
      el("div", { class: "me__sub", text: p ? subtitleFor(p) : "로그인하면 학교 공지를 볼 수 있어요" }),
      p?.privilege.length
        ? el("div", { class: "me__privs" },
            p.privilege.map((v) => el("span", { class: "badge badge--soft", text: v })))
        : null)));

  /* QR + 설치 안내 */
  stack.append(el("div", { class: "panel" },
    el("div", { class: "panel__head" },
      el("h3", { text: "스마트폰에서 열기" }),
      el("p", { text: "키오스크 화면에서 QR을 찍으면 바로 열립니다." })),
    el("div", { class: "qr" },
      el("img", {
        src: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Feduinfo.sungil-i.kr%2Fstu",
        alt: "S:NOW 주소 QR코드", width: "150", height: "150", loading: "lazy",
      }),
      el("p", { text: "eduinfo.sungil-i.kr/stu" }))));

  /* 도움말 */
  const help = el("div", { class: "panel" },
    el("div", { class: "panel__head" }, el("h3", { text: "도움말" })));
  for (const item of HELP) {
    const row = el("button", { class: "row", type: "button" },
      el("span", { class: "ico", "aria-hidden": "true", text: item.icon }),
      el("span", { text: item.title }),
      el("span", { class: "sub", text: "＋" }));
    const body = el("div", { class: "help-body", text: item.body, hidden: true });
    row.addEventListener("click", () => {
      body.hidden = !body.hidden;
      row.querySelector(".sub").textContent = body.hidden ? "＋" : "－";
    });
    help.append(row, body);
  }
  stack.append(help);

  /* 계정 */
  const account = el("div", { class: "panel" });
  if (A.isAdmin()) {
    account.append(el("a", { class: "row", href: "admin.html" },
      el("span", { class: "ico", "aria-hidden": "true", text: "⚙" }),
      el("span", { text: "관리 콘솔" }),
      el("span", { class: "sub", text: "›" })));
  }
  if (A.session.profile) {
    account.append(el("button", { class: "row", type: "button", onclick: doLogout },
      el("span", { class: "ico", "aria-hidden": "true", text: "⏻" }),
      el("span", { text: "로그아웃" })));
  } else {
    account.append(el("button", {
      class: "row", type: "button",
      onclick: () => { A.exitGuest(); showGate(); },
    },
      el("span", { class: "ico", "aria-hidden": "true", text: "→" }),
      el("span", { text: "로그인하기" })));
  }
  stack.append(account);

  stack.append(versionLine());
  wrap.append(stack);
  return wrap;
}

/** 버전 표시 — JS 와 CSS 가 다르면 캐시가 낡은 것입니다. */
function versionLine() {
  const cssVer = getComputedStyle(document.documentElement)
    .getPropertyValue("--css-version").trim().replace(/["']/g, "") || "알 수 없음";
  const stale = cssVer !== APP_VERSION;

  const line = el("p", {
    style: "text-align:center;font-size:12px;margin-top:6px;color:"
      + (stale ? "var(--danger)" : "var(--muted)"),
    text: stale
      ? `⚠ 화면 파일이 낡았습니다 (앱 v${APP_VERSION} · 화면 v${cssVer})`
      : `S:NOW v${APP_VERSION} · 성일정보고등학교`,
  });
  if (!stale) return line;

  const fix = el("button", {
    class: "btn btn--line btn--sm", type: "button",
    style: "display:block;margin:8px auto 0",
    text: "캐시 비우고 새로고침",
    onclick: async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
        await Promise.all(regs.map((r) => r.unregister()));
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (err) { console.warn(err); }
      location.reload();
    },
  });
  return el("div", {}, line, fix);
}

function subtitleFor(p) {
  if (p.role === "교사") return `${p.name} 선생님 · ${p.email}`;
  return `${p.classKey.replace("-", "학년 ")}반 ${p.number ?? "?"}번`;
}

async function doLogout() {
  const ok = await askConfirm({ title: "로그아웃할까요?", message: "다음에 다시 로그인하면 됩니다.", okLabel: "로그아웃" });
  if (!ok) return;
  resetCache();
  await A.leave();
  showGate();
}

function resetCache() {
  state.items = { all: [], class: [], external: [] };
  state.cursor = { all: null, class: null, external: null };
  state.done = { all: false, class: false, external: false };
  state.loaded = { all: false, class: false, external: false };
  state.classSize = null;
}

/* ── 서비스워커 ────────────────────────────────────────── */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  /* 개발용 비상구: index.html?sw=off 로 열면 서비스워커와 캐시를 모두 비웁니다.
     "파일을 고쳤는데 화면이 안 바뀐다" 싶을 때 한 번 열어 주세요. */
  if (new URLSearchParams(location.search).get("sw") === "off") {
    (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast("서비스워커와 캐시를 비웠습니다. 주소에서 ?sw=off 를 지우고 새로고침하세요.", "ok", 8000);
    })();
    return;
  }

  addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch((err) => console.warn("[sw] 등록 실패", err));
  });
}
