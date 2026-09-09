/* ============================================================
   register.js — 처음 로그인한 사람의 본인 등록 화면.

   흐름:  역할 선택 → 정보 입력 → 확인 → 저장
   저장은 딱 한 번만 됩니다. 보안 규칙의 create 가 신규 문서에만
   성공하므로, 저장 후에는 본인이 고칠 수 없습니다.
   그래서 마지막에 확인 단계를 둡니다.
   ============================================================ */
import { el } from "./render.js";
import { toast } from "./ui.js";
import { registerSelf } from "./db.js";

const GRADES = [1, 2, 3];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * @param {{email:string, displayName?:string}} user 로그인한 계정
 */
export function showRegister(user) {
  const host = document.getElementById("reg");
  host.hidden = false;
  document.getElementById("gate").hidden = true;
  document.getElementById("app").classList.remove("is-ready");

  const draft = {
    role: null,
    name: (user.displayName || "").trim(),
    grade: null,
    klass: null,
    number: null,
  };

  /* ── 1단계: 역할 ────────────────────────────────────── */
  function step1() {
    paint(
      "처음 오셨네요",
      `${user.email} 계정으로 로그인했습니다.\n어느 쪽이신가요?`,
      el("div", { class: "reg__roles" },
        roleCard("🎒", "학생", "학년·반·번호를 입력하면 바로 이용할 수 있어요", () => {
          draft.role = "학생"; step2();
        }),
        roleCard("🧑‍🏫", "선생님", "신청 후 교육정보부 승인이 필요합니다", () => {
          draft.role = "교사"; step2();
        })),
      null);
  }

  const roleCard = (icon, title, desc, run) =>
    el("button", { class: "reg__role", type: "button", onclick: run },
      el("span", { class: "reg__role-ico", "aria-hidden": "true", text: icon }),
      el("span", {},
        el("b", { text: title }),
        el("small", { text: desc })),
      el("span", { class: "reg__role-go", "aria-hidden": "true", text: "›" }));

  /* ── 2단계: 정보 입력 ───────────────────────────────── */
  function step2() {
    const isStudent = draft.role === "학생";

    const name = el("input", {
      class: "input", type: "text", maxlength: "20",
      placeholder: "이름", value: draft.name, autocomplete: "name",
    });

    const body = el("div", {},
      el("div", { class: "field" }, el("label", { text: "이름" }), name));

    let gradeRow, classRow, number;

    if (isStudent) {
      gradeRow = pickRow(GRADES, "학년", (v) => { draft.grade = v; });
      classRow = pickRow(CLASSES, "반", (v) => { draft.klass = v; });
      number = el("input", {
        class: "input", type: "number", inputmode: "numeric",
        min: "1", max: "60", placeholder: "번호 (숫자만)",
      });
      body.append(
        el("div", { class: "field" }, el("label", { text: "학년" }), gradeRow),
        el("div", { class: "field" }, el("label", { text: "반" }), classRow),
        el("div", { class: "field" }, el("label", { text: "번호" }), number));
    } else {
      gradeRow = pickRow(GRADES, "학년", (v) => { draft.grade = v; }, true);
      classRow = pickRow(CLASSES, "반", (v) => { draft.klass = v; }, true);
      body.append(
        el("p", { class: "reg__hint", text: "담임을 맡고 계시면 학년·반을 골라 주세요. 아니면 비워 두셔도 됩니다." }),
        el("div", { class: "field" }, el("label", { text: "담임 학년 (선택)" }), gradeRow),
        el("div", { class: "field" }, el("label", { text: "담임 반 (선택)" }), classRow));
    }

    const next = el("button", { class: "btn btn--primary btn--full", type: "button", text: "다음" });
    next.addEventListener("click", () => {
      draft.name = name.value.trim();
      if (!draft.name) { toast("이름을 입력해 주세요.", "bad"); name.focus(); return; }

      if (isStudent) {
        if (!draft.grade) { toast("학년을 골라 주세요.", "bad"); return; }
        if (!draft.klass) { toast("반을 골라 주세요.", "bad"); return; }
        const n = parseInt(number.value, 10);
        if (!Number.isFinite(n) || n < 1 || n > 60) { toast("번호를 1~60 사이로 입력해 주세요.", "bad"); return; }
        draft.number = n;
      }
      step3();
    });

    paint(draft.role === "학생" ? "학생 등록" : "선생님 등록",
      null, body,
      el("div", { class: "reg__actions" },
        el("button", { class: "btn btn--ghost", type: "button", text: "뒤로", onclick: step1 }),
        next));
  }

  /** 숫자 칩 줄 */
  function pickRow(values, unit, onPick, clearable = false) {
    const row = el("div", { class: "reg__picks" });
    const chips = [];
    for (const v of values) {
      const c = el("button", { class: "chip", type: "button", text: `${v}${unit}` });
      c.addEventListener("click", () => {
        const already = c.classList.contains("is-on");
        chips.forEach((x) => x.classList.remove("is-on"));
        if (clearable && already) { onPick(null); return; }
        c.classList.add("is-on");
        onPick(v);
      });
      chips.push(c);
      row.append(c);
    }
    return row;
  }

  /* ── 3단계: 확인 ────────────────────────────────────── */
  function step3() {
    const line = draft.role === "학생"
      ? `${draft.grade}학년 ${draft.klass}반 ${draft.number}번 ${draft.name}`
      : `${draft.name} 선생님${draft.grade && draft.klass ? ` · ${draft.grade}학년 ${draft.klass}반 담임` : ""}`;

    const save = el("button", { class: "btn btn--primary btn--full", type: "button", text: "이대로 등록하기" });
    save.addEventListener("click", () => submit(save));

    paint("맞는지 확인해 주세요", null,
      el("div", {},
        el("div", { class: "reg__confirm" },
          el("div", { class: "reg__confirm-line", text: line }),
          el("div", { class: "reg__confirm-mail", text: user.email })),
        el("div", { class: "reg__warn" },
          el("b", { text: "한 번 등록하면 본인은 수정할 수 없습니다." }),
          el("span", {
            text: draft.role === "학생"
              ? "잘못 입력했다면 담임 선생님이나 교육정보부에 말씀해 주세요."
              : "등록 후 교육정보부의 승인을 받아야 반별 기능을 쓸 수 있습니다.",
          }))),
      el("div", { class: "reg__actions" },
        el("button", { class: "btn btn--ghost", type: "button", text: "고치기", onclick: step2 }),
        save));
  }

  async function submit(btn) {
    btn.disabled = true;
    btn.textContent = "등록하는 중…";
    try {
      await registerSelf({
        email: user.email,
        name: draft.name,
        role: draft.role,
        grade: draft.grade,
        klass: draft.klass,
        number: draft.number,
      });
      done();
    } catch (err) {
      console.error("[register]", err);
      btn.disabled = false;
      btn.textContent = "이대로 등록하기";
      toast(err?.code === "permission-denied"
        ? "이미 등록된 계정이거나 입력값이 규칙에 맞지 않습니다. 교육정보부로 문의해 주세요."
        : "등록에 실패했습니다. 잠시 후 다시 시도해 주세요.", "bad", 6000);
    }
  }

  function done() {
    const isStudent = draft.role === "학생";
    paint(isStudent ? "등록 완료!" : "신청 완료!",
      isStudent
        ? "이제 바로 이용할 수 있습니다."
        : "교육정보부에서 승인하면 반별 기능이 열립니다.\n그전에도 전체·대외 공지는 보실 수 있습니다.",
      el("div", { class: "reg__done", "aria-hidden": "true", text: isStudent ? "🎉" : "📨" }),
      el("button", {
        class: "btn btn--primary btn--full", type: "button",
        text: "시작하기", onclick: () => location.reload(),
      }));
  }

  /* ── 그리기 ─────────────────────────────────────────── */
  function paint(title, lead, body, actions) {
    host.textContent = "";
    host.append(el("div", { class: "reg__inner" },
      el("div", { class: "reg__mark" }, "S", el("i", { text: ":" }), "NOW"),
      el("h1", { class: "reg__title", text: title }),
      lead ? el("p", { class: "reg__lead", text: lead }) : null,
      body,
      actions));
    host.scrollTop = 0;
  }

  // 화면 그리기는 위의 const 선언이 모두 끝난 뒤에 시작합니다.
  step1();
}
