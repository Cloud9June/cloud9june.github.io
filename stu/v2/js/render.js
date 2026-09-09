/* ============================================================
   render.js — 데이터 → DOM.

   이 파일에는 innerHTML 이 한 번도 나오지 않습니다.
   본문에 무엇이 들어와도 마크업으로 해석되지 않습니다.
   ============================================================ */
import { TRUSTED_LINK_HOSTS } from "./config.js";

/* ── 작은 헬퍼 ─────────────────────────────────────────── */

/** el("div", {class:"a", text:"안녕"}, child1, child2) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") throw new Error("html 속성은 쓰지 않습니다");
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
  return node;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");

/** 사람이 읽는 시간 */
export function fmtWhen(date) {
  if (!date) return "방금";
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `어제 ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (date.getFullYear() === now.getFullYear())
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** 오늘 날짜 한 줄 */
export function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
}

/* ── 본문 렌더링 (XSS 방어의 핵심) ─────────────────────── */

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/**
 * 본문을 node 안에 안전하게 그립니다.
 * 신뢰 도메인만 링크가 되고, 나머지는 평범한 텍스트로 남습니다.
 */
export function linkifyInto(node, text = "") {
  node.textContent = "";
  let last = 0;
  let m;
  URL_RE.lastIndex = 0;

  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) node.append(text.slice(last, m.index));

    const raw = m[0];
    let host = null;
    try { host = new URL(raw).hostname.toLowerCase(); } catch { /* 잘못된 URL */ }

    if (host && TRUSTED_LINK_HOSTS.has(host)) {
      node.append(el("a", {
        class: "link-ok",
        href: raw,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "링크 열기",
      }));
    } else {
      node.append(el("span", { class: "link-blocked", text: raw, title: "허용되지 않은 주소입니다" }));
    }
    last = URL_RE.lastIndex;
  }
  if (last < text.length) node.append(text.slice(last));
  return node;
}

/* ── 조각 ──────────────────────────────────────────────── */

export const tagChip = (t) => el("span", { class: "tag", text: t });

export const numChip = (n) => el("span", { class: "num", text: String(n) });

export function skeletons(count = 3) {
  return Array.from({ length: count }, () =>
    el("div", { class: "skel" }, el("i"), el("i"), el("i"), el("i")));
}

export function emptyState(icon, title, desc) {
  return el("div", { class: "empty" },
    el("div", { class: "ico", "aria-hidden": "true", text: icon }),
    el("b", { text: title }),
    desc ? el("p", { text: desc }) : null);
}

/* ── 피드 카드 ─────────────────────────────────────────── */

/**
 * @param {object} feed  db.js 가 만든 피드 객체
 * @param {object} ctx   { tab, canManage, myNumber, canSeeRoster, onMenu, onConfirm }
 */
export function feedCard(feed, ctx) {
  const card = el("article", {
    class: "card" + (feed.important ? " card--important" : ""),
    dataset: { id: feed.id, tags: feed.tags.join(" ") },
  });

  /* 윗줄: 배지 · 작성자 · 시간 · 메뉴 */
  const top = el("div", { class: "card__top" });
  if (feed.important) {
    top.append(el("span", { class: "badge badge--important" }, "중요"));
  }
  top.append(el("span", {
    class: "card__meta",
    text: `${feed.authorName} · ${fmtWhen(feed.createdAt)}${feed.updatedAt ? " (수정됨)" : ""}`,
  }));
  if (ctx.canManage) {
    top.append(el("button", {
      class: "card__more",
      type: "button",
      "aria-label": `${feed.title} 관리 메뉴`,
      onclick: () => ctx.onMenu(feed),
    }, "⋯"));
  }
  card.append(top);

  /* 제목 · 본문 */
  card.append(el("h3", { class: "card__title", text: feed.title }));

  const body = el("div", { class: "card__body" });
  linkifyInto(body, feed.content);
  card.append(body);

  /* 긴 글은 접어 둡니다 */
  if (feed.content.length > 260) {
    body.classList.add("is-clamped");
    const more = el("button", { class: "card__expand", type: "button", text: "더 보기" });
    more.addEventListener("click", () => {
      const open = body.classList.toggle("is-clamped");
      more.textContent = open ? "더 보기" : "접기";
    });
    card.append(more);
  }

  /* 태그 */
  if (feed.tags.length) {
    card.append(el("div", { class: "card__tags" }, feed.tags.map(tagChip)));
  }

  /* 중요 알림 확인 영역 */
  if (ctx.tab === "class" && feed.important) {
    card.append(confirmBlock(feed, ctx));
  }

  return card;
}

function confirmBlock(feed, ctx) {
  const foot = el("div", { class: "card__foot" });
  const wrap = el("div", { class: "confirm" });
  const remaining = feed.students.length;

  if (remaining === 0) {
    wrap.append(el("div", { class: "confirm__stat" },
      el("span", { class: "badge badge--done", text: "모두 확인함" })));
    foot.append(wrap);
    return foot;
  }

  /* 진행 막대 — 전체 인원을 모르면 남은 인원만 보여줍니다 */
  const total = ctx.classSize || remaining;
  const doneCount = Math.max(0, total - remaining);
  wrap.append(el("div", { class: "confirm__stat" },
    el("span", { text: `${remaining}명 미확인` }),
    ctx.classSize ? el("span", { text: `· ${doneCount}/${total} 확인` }) : null));

  if (ctx.classSize) {
    const bar = el("div", { class: "confirm__bar" });
    const fill = el("i");
    fill.style.width = `${(doneCount / total) * 100}%`;
    bar.append(fill);
    wrap.append(bar);
  }

  /* 선생님·반장은 미확인 번호를 봅니다 */
  if (ctx.canSeeRoster) {
    wrap.append(el("div", { class: "confirm__nums" }, feed.students.map(numChip)));
  }

  /* 확인 버튼은 "번호가 있는 학생 본인"에게만.
     선생님은 번호가 0/없음이므로 확인 UI 자체가 나오지 않습니다. */
  const isMine = ctx.isStudent && ctx.myNumber !== null;
  if (isMine && feed.students.includes(ctx.myNumber)) {
    const btn = el("button", {
      class: "btn btn--primary btn--full btn--sm",
      type: "button",
      text: "확인했어요",
    });
    btn.addEventListener("click", () => ctx.onConfirm(feed, btn));
    wrap.append(btn);
  } else if (isMine) {
    wrap.append(el("div", { class: "confirm__stat" },
      el("span", { class: "badge badge--done", text: "확인 완료" })));
  }

  foot.append(wrap);
  return foot;
}
