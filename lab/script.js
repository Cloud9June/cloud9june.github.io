// ==========================================================
// 🏫 실습실 관리 시스템 - 메인 로직
// ==========================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { initAuth, getIsSuperAdmin, getUserEmail } from "./auth.js";
import {
  labs,
  ISSUE_OPTIONS,
  HIDDEN_OPTION,
  RESTORE_OPTION,
  SPEC_FIELDS,
  GRADE_LETTERS,
  GRADE_MODIFIERS,
  CLASS_CAPACITY,
} from "./labs-data.js";

// ----------------------------------------------------------
// DOM 참조
// ----------------------------------------------------------
const dashboardView = document.getElementById("dashboard-view");
const labView = document.getElementById("lab-view");
const brandBtn = document.getElementById("brand-btn");
const backBtn = document.getElementById("back-btn");

const kpiRowEl = document.getElementById("kpi-row");
const labGridEl = document.getElementById("lab-grid");
const adminNoticeEl = document.getElementById("admin-notice");

const labSwitcherEl = document.getElementById("lab-switcher");
const noticeEl = document.getElementById("lab-notice");
const timeSlotRowEl = document.getElementById("time-slot-row");
const seatGridEl = document.getElementById("seat-grid");
const labNameTextEl = document.getElementById("lab-name-text");
const labLocationBadgeEl = document.getElementById("lab-location-badge");
const managerBadgeEl = document.getElementById("manager-badge");
const descEl = document.getElementById("current-lab-desc");
const editInfoBtn = document.getElementById("edit-info-btn");
const toggleClosedBtn = document.getElementById("toggle-closed-btn");

const modal = document.getElementById("modal");
const modalTitle = document.querySelector("#modal .modal-content h3");
const issueSelect = document.getElementById("issue-select");
const substituteFieldEl = document.getElementById("substitute-field");
const substituteCheckbox = document.getElementById("substitute-checkbox");
const substituteNoteInput = document.getElementById("substitute-note");

const manageTeachersBtn = document.getElementById("manage-teachers-btn");
const teacherModal = document.getElementById("teacher-modal");
const teacherListEl = document.getElementById("teacher-list");
const closeTeacherModalBtn = document.getElementById("close-teacher-modal-btn");
const manageRosterBtn = document.getElementById("manage-roster-btn");

const rosterModal = document.getElementById("roster-modal");
const rosterListEl = document.getElementById("roster-list");
const closeRosterModalBtn = document.getElementById("close-roster-modal-btn");
const rosterNameInput = document.getElementById("roster-name-input");
const rosterEmailInput = document.getElementById("roster-email-input");
const addRosterBtn = document.getElementById("add-roster-btn");
const rosterBulkInput = document.getElementById("roster-bulk-input");
const addRosterBulkBtn = document.getElementById("add-roster-bulk-btn");

const assignModal = document.getElementById("assign-modal");
const assignModalTitle = document.getElementById("assign-modal-title");
const assignSearchInput = document.getElementById("assign-search-input");
const assignListEl = document.getElementById("assign-list");
const closeAssignModalBtn = document.getElementById("close-assign-modal-btn");
const assignCancelBtn = document.getElementById("assign-cancel-btn");
const assignSaveBtn = document.getElementById("assign-save-btn");

const specsListEl = document.getElementById("specs-list");
const specGradeBadgeEl = document.getElementById("spec-grade-badge");
const specGradeSelect = document.getElementById("spec-grade");
const editSpecsBtn = document.getElementById("edit-specs-btn");
const specsModal = document.getElementById("specs-modal");
const specsCancelBtn = document.getElementById("specs-cancel-btn");
const specsSaveBtn = document.getElementById("specs-save-btn");

// 등급 선택 옵션은 labs-data.js의 GRADE_LETTERS/GRADE_MODIFIERS로 한 번만 채워둔다.
// S는 세분화 없이 단독 옵션으로, 나머지는 "A+/A0/A-"처럼 글자별로 묶어(optgroup) 보여준다.
GRADE_LETTERS.forEach((letter) => {
  if (letter === "S") {
    const opt = document.createElement("option");
    opt.value = "S";
    opt.textContent = "S";
    specGradeSelect.appendChild(opt);
    return;
  }
  const group = document.createElement("optgroup");
  group.label = letter;
  GRADE_MODIFIERS.forEach((modifier) => {
    const opt = document.createElement("option");
    opt.value = `${letter}${modifier}`;
    opt.textContent = `${letter}${modifier}`;
    group.appendChild(opt);
  });
  specGradeSelect.appendChild(group);
});

const programsListEl = document.getElementById("programs-list");
const addProgramBtn = document.getElementById("add-program-btn");

const userInfoEl = document.getElementById("user-info");

// ----------------------------------------------------------
// 인증 초기화
// ----------------------------------------------------------
initAuth(
  {
    loginBtn: document.getElementById("login-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    userInfoEl,
    avatarEl: document.getElementById("user-avatar"),
  },
  (isSuperAdmin) => {
    // "담당자 관리" 버튼은 전체관리자에게만 보인다.
    manageTeachersBtn.hidden = !isSuperAdmin;
    // 전달사항 추가 버튼 등 권한에 따라 달라지는 UI는 로그인 판정이 onSnapshot보다
    // 늦게 끝날 수 있으므로, 로그인 상태가 바뀔 때마다 현재 화면을 다시 그려준다.
    if (activeLab) {
      renderNotice(activeLab, activeNoticeText);
      updateLabAccessUI();
    }
    // 전체관리자가 아니면, 이 계정이 담당하고 있는 실습실이 있는지 확인해서
    // 상단 표시를 "3실 관리자 · 이름"처럼 전체관리자와 같은 방식으로 보여준다.
    updateManagerHeaderLabel(isSuperAdmin);
  }
);

// 로그인한 사용자가 "어떤 실습실이든" 담당 선생님으로 등록되어 있는지 여부.
// 대시보드 전용(전체관리자 전용) 공지를 볼 수 있는지 판단하는 데도 쓰인다.
let isAnyLabManagerGlobal = false;

/** 로그인한 사용자가 전체관리자가 아니면, 담당 중인 실습실이 있는지 확인해 상단 표시를 갱신한다. */
async function updateManagerHeaderLabel(isSuperAdmin) {
  if (isSuperAdmin) {
    // 전체관리자 표시는 auth.js가 이미 처리함. 이 플래그는 전체관리자에게는 의미가 없다
    // (canViewAdminNotice()가 getIsSuperAdmin()을 별도로 확인하므로).
    isAnyLabManagerGlobal = false;
    loadAdminNotice();
    return;
  }

  const email = getUserEmail();
  if (!email) {
    // 로그아웃 상태 (auth.js가 이미 "로그인이 필요합니다"로 표시함)
    isAnyLabManagerGlobal = false;
    loadAdminNotice();
    return;
  }

  try {
    const snap = await getDocs(query(collection(db, "labs"), where("managers", "array-contains", email)));
    if (getUserEmail() !== email) return; // 조회하는 동안 로그아웃/재로그인 등으로 상태가 바뀌었으면 무시

    isAnyLabManagerGlobal = !snap.empty;

    if (!snap.empty) {
      const managedNames = snap.docs
        .map((docSnap) => labs.find((lab) => lab.id === docSnap.id))
        .filter(Boolean)
        .map((lab) => shortLabName(lab.name));
      if (managedNames.length > 0) {
        const baseName = userInfoEl.textContent; // auth.js가 이미 넣어둔 순수 이름
        userInfoEl.textContent = `${managedNames.join("·")} 관리자 · ${baseName}`;
      }
    }

    loadAdminNotice();
  } catch (error) {
    console.error("담당 실습실 확인 중 오류:", error);
    isAnyLabManagerGlobal = false;
    loadAdminNotice();
  }
}

// ----------------------------------------------------------
// 🔒 전체관리자 전용 공지 (실습실 종합 현황 전용)
//    - 작성·수정: 전체관리자만
//    - 열람: 전체관리자 + 실습실 담당 선생님만 (학생·일반 방문자에게는 아예 보이지 않음)
// ----------------------------------------------------------
function canViewAdminNotice() {
  return getIsSuperAdmin() || isAnyLabManagerGlobal;
}

async function loadAdminNotice() {
  if (!canViewAdminNotice()) {
    adminNoticeEl.hidden = true;
    return;
  }
  try {
    const snap = await getDoc(doc(db, "settings", "dashboard_notice"));
    renderAdminNotice(snap.exists() ? snap.data().text || "" : "");
  } catch (error) {
    console.error("담당자 전용 공지 로딩 실패:", error);
    adminNoticeEl.hidden = true;
  }
}

function renderAdminNotice(text) {
  const canEdit = getIsSuperAdmin();
  adminNoticeEl.innerHTML = "";

  if (!text) {
    if (!canEdit) {
      // 담당 선생님은 보기 전용이라, 내용이 없으면 아무것도 보여줄 필요가 없다.
      adminNoticeEl.hidden = true;
      return;
    }
    adminNoticeEl.hidden = false;
    adminNoticeEl.className = "admin-notice admin-notice--empty";
    const addBtn = document.createElement("button");
    addBtn.className = "admin-notice__add";
    addBtn.textContent = "+ 담당자 전용 공지 추가";
    addBtn.addEventListener("click", () => editAdminNotice(""));
    adminNoticeEl.appendChild(addBtn);
    return;
  }

  adminNoticeEl.hidden = false;
  adminNoticeEl.className = "admin-notice";

  const icon = document.createElement("span");
  icon.className = "admin-notice__icon";
  icon.textContent = "🔒";

  const body = document.createElement("div");
  body.className = "admin-notice__body";
  const label = document.createElement("div");
  label.className = "admin-notice__label";
  label.textContent = "담당자 전용 공지";
  const p = document.createElement("p");
  p.className = "admin-notice__text";
  p.textContent = text;
  body.appendChild(label);
  body.appendChild(p);

  adminNoticeEl.appendChild(icon);
  adminNoticeEl.appendChild(body);

  if (canEdit) {
    const editBtn = document.createElement("button");
    editBtn.className = "admin-notice__edit";
    editBtn.title = "공지 수정";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => editAdminNotice(text));
    adminNoticeEl.appendChild(editBtn);
  }
}

async function editAdminNotice(currentText) {
  if (!getIsSuperAdmin()) {
    alert("이 공지는 전체관리자만 작성·수정할 수 있습니다.");
    return;
  }

  const newText = prompt(
    "실습실 종합 현황 화면에만 표시되는 담당자 전용 공지입니다.\n" +
      "전체관리자와 실습실 담당 선생님만 볼 수 있고, 다른 방문자에게는 보이지 않습니다.\n" +
      "(비워두고 저장하면 삭제됩니다)",
    currentText
  );
  if (newText === null) return; // 취소

  const trimmed = newText.trim();
  try {
    await setDoc(doc(db, "settings", "dashboard_notice"), { text: trimmed, updatedAt: serverTimestamp() });
    renderAdminNotice(trimmed);
  } catch (error) {
    console.error("담당자 전용 공지 저장 실패:", error);
    alert("공지를 저장하지 못했습니다: " + error.message);
  }
}

/**
 * 현재 로그인한 사용자가 지금 보고 있는 실습실을 관리할 권한이 있는지 여부.
 * 전체관리자이거나, 이 실습실의 담당 선생님(labs/{id}.managers)으로 등록되어 있으면 true.
 */
function canManageActiveLab() {
  if (getIsSuperAdmin()) return true;
  const email = getUserEmail();
  return !!email && activeLabManagers.includes(email);
}

/** 현재 실습실을 관리할 권한이 없으면 안내 후 false를 반환하는 공용 가드 */
function requireCanManage() {
  if (!canManageActiveLab()) {
    alert("이 실습실을 관리할 권한이 없습니다. (전체관리자 또는 담당 선생님만 가능)");
    return false;
  }
  return true;
}

/** 전달사항처럼 전체관리자만 쓸 수 있는 기능에 쓰는 가드 (실습실 담당 선생님은 보기만 가능) */
function requireSuperAdmin() {
  if (!getIsSuperAdmin()) {
    alert("전달사항은 전체관리자만 등록·수정할 수 있습니다. (실습실 담당 선생님은 보기만 가능합니다)");
    return false;
  }
  return true;
}

/** rows/cols가 0으로 등록된(애초에 좌석을 배치한 적 없는) 실습실인지 여부 — 이런 곳은 점검 토글 대상이 아니다. */
function isStructurallyEmptyLab() {
  return !!activeLab && activeLab.rows === 0 && activeLab.cols === 0;
}

/** 현재 실습실에 대한 권한 상태를 좌석/시점/편집 버튼의 커서 등 화면에 반영한다. */
function updateLabAccessUI() {
  const canManage = canManageActiveLab();
  const isSuper = getIsSuperAdmin();
  labView.classList.toggle("is-guest", !canManage);
  managerBadgeEl.hidden = !(canManage && !isSuper);
  // 사양 정보 · 설치 프로그램 모두 좌석과 같은 등급(전체관리자 + 해당 실습실 담당 선생님)만 수정 가능.
  editSpecsBtn.hidden = !canManage;
  addProgramBtn.hidden = !canManage;
  renderPrograms(); // 삭제(✕) 버튼 표시 여부가 canManage에 따라 달라지므로 다시 그린다.

  // 점검/공사 토글 버튼 — 좌석을 아예 배치한 적 없는 실습실에는 의미가 없으므로 숨긴다.
  toggleClosedBtn.hidden = !canManage || isStructurallyEmptyLab();
  toggleClosedBtn.classList.toggle("is-closed-active", activeClosed);
  toggleClosedBtn.textContent = activeClosed ? "✅" : "🚧";
  toggleClosedBtn.title = activeClosed ? "점검/공사 종료하고 다시 운영" : "점검/공사 중으로 표시";
}

// ----------------------------------------------------------
// 실시간 리스너(onSnapshot) 관리
// 실습실을 옮겨 다닐 때 이전 리스너를 정리하지 않으면 리스너가 계속 쌓여
// 화면에 없는 실습실의 갱신까지 처리하고 Firestore 읽기 비용도 증가한다.
// 현재 열려 있는 구독을 배열로 관리하고, 화면을 옮길 때마다 모두 해제한다.
// ----------------------------------------------------------
let activeUnsubscribers = [];
function clearActiveListeners() {
  activeUnsubscribers.forEach((unsub) => unsub());
  activeUnsubscribers = [];
}

// 좌석 자동 생성이 중복 실행되지 않도록 실습실별로 진행 여부를 표시
const seedingInProgress = new Set();

// 대시보드 카드/스위처의 상태 점(dot) 표시에 재사용하는 캐시: labId -> "normal" | "error" | "maintenance" | "unknown"
const labStatusCache = new Map();

// 현재 화면에 표시 중인 실습실 / 모달에서 다루는 좌석 문서 id
let currentLabId = null;
let currentDocId = null;

// 전달사항/권한 재렌더링용으로 현재 보고 있는 실습실, 전달사항, 담당 선생님 이메일을 기억해둔다.
// (권한 판정이 onSnapshot보다 늦게 끝나는 경우 로그인 완료 시점에 다시 그리기 위함)
let activeLab = null;
let activeNoticeText = "";
let activeLabManagers = [];
let activeSpecs = {};
let activeGrade = ""; // "" | "S" | "A" | ... | "F"
let activeClosed = false; // 공사/점검 등으로 실습실 전체를 일시적으로 사용 중지했는지 여부
let activeClosedReason = "";
let activeProgramsData = []; // [{ id, name, addedBy }]

// ----------------------------------------------------------
// 화면 전환
// ----------------------------------------------------------
brandBtn.addEventListener("click", goToDashboard);
backBtn.addEventListener("click", goToDashboard);

function goToDashboard() {
  clearActiveListeners();
  activeLab = null;
  activeNoticeText = "";
  activeLabManagers = [];
  activeSpecs = {};
  activeGrade = "";
  activeClosed = false;
  activeClosedReason = "";
  activeProgramsData = [];
  labView.classList.remove("is-guest");
  dashboardView.style.display = "block";
  labView.style.display = "none";
  loadDashboardData();
}

function goToLab(lab) {
  loadLab(lab);
}

// ----------------------------------------------------------
// 📊 대시보드 (실습실 전체 현황 카드)
// ----------------------------------------------------------

async function loadDashboardData() {
  if (!labGridEl) return;
  labGridEl.innerHTML = '<p class="loading-msg">데이터를 불러오는 중입니다... ⏳</p>';

  // 실습실 16개를 순차(await in for)로 불러오면 느리므로 병렬로 조회한다.
  // 한 실습실 조회가 실패해도 나머지 카드 표시에 영향이 없도록 개별적으로 오류를 처리한다.
  const results = await Promise.all(
    labs.map(async (lab) => {
      const isStructurallyEmpty = lab.rows === 0 && lab.cols === 0;

      // 등급·점검 상태는 좌석 조회 전에 먼저 알아야 한다 — 점검 중이면 좌석은 조회할 필요가 없다.
      let labData = {};
      try {
        const labSnap = await getDoc(doc(db, "labs", lab.id));
        labData = labSnap.exists() ? labSnap.data() : {};
      } catch (error) {
        console.error(`${lab.name} 정보 조회 실패:`, error);
      }
      const grade = labData.grade || "";
      const isClosed = isStructurallyEmpty || labData.closed === true;

      if (isClosed) {
        labStatusCache.set(lab.id, "maintenance");
        return { lab, maintenance: true, grade, closedReason: labData.closedReason || "" };
      }

      try {
        const snapshot = await getDocs(collection(db, `labs/${lab.id}/seats`));
        const seatsData = [];
        snapshot.forEach((docSnap) => seatsData.push(docSnap.data()));
        // 좌석 그리드(renderSeatGrid)와 동일하게 원래 번호(seat.id) 순으로 정렬한 뒤,
        // 빈 자리를 건너뛰고 화면에 실제로 보이는 순번을 다시 매긴다.
        // (대시보드의 "고장 n번" 목록이 좌석 그리드에 보이는 번호와 어긋나지 않도록)
        seatsData.sort((a, b) => a.id - b.id);

        let total = 0;
        let available = 0;
        let displayCounter = 0;
        const errorList = [];

        seatsData.forEach((seat) => {
          if (seat.isHidden) return; // 빈 공간은 좌석 수·번호 모두에서 제외
          displayCounter++;
          total++;
          if (seat.status === "normal") {
            available++;
          } else {
            errorList.push(displayCounter);
          }
        });

        labStatusCache.set(lab.id, errorList.length > 0 ? "error" : "normal");
        return { lab, total, available, errorList, grade };
      } catch (error) {
        console.error(`${lab.name} 현황 로딩 실패:`, error);
        labStatusCache.set(lab.id, "unknown");
        return { lab, failed: true, grade: "" };
      }
    })
  );

  renderKpiRow(results);
  labGridEl.innerHTML = results.map(renderLabCard).join("");
  labGridEl.querySelectorAll(".lab-card").forEach((card) => {
    card.addEventListener("click", () => {
      const lab = labs.find((l) => l.id === card.dataset.labId);
      if (lab) goToLab(lab);
    });
  });
}

function renderKpiRow(results) {
  let totalSeats = 0;
  let totalAvailable = 0;
  let totalErrors = 0;
  let maintenanceCount = 0;

  results.forEach((r) => {
    if (r.maintenance) {
      maintenanceCount++;
      return;
    }
    if (r.failed) return;
    totalSeats += r.total;
    totalAvailable += r.available;
    totalErrors += r.errorList.length;
  });

  kpiRowEl.innerHTML = [
    kpiTile("전체 실습실", `${labs.length}개`),
    kpiTile("전체 좌석", `${totalSeats}석`),
    kpiTile("사용 가능", `${totalAvailable}석`, "kpi-tile--success"),
    kpiTile("고장 · 점검", `${totalErrors}석 / ${maintenanceCount}실`, "kpi-tile--error"),
  ].join("");
}

function kpiTile(label, value, extraClass = "") {
  return `
    <div class="kpi-tile ${extraClass}">
      <span class="kpi-tile__label">${label}</span>
      <span class="kpi-tile__value">${value}</span>
    </div>`;
}

// 색상은 "B+"/"B0"/"B-" 모두 같은 B 색으로 — 맨 앞 글자만 보고 등급 색을 정한다.
function gradeBadgeHtml(grade) {
  return grade ? `<span class="grade-badge grade-badge--${grade.charAt(0)}">${grade}</span>` : "";
}

// 대시보드 카드 전체를 문자열로 조립해 innerHTML에 넣는 방식이라, 선생님이 직접 입력하는
// 점검 사유 같은 자유 텍스트는 그대로 끼워 넣지 않고 이스케이프해서 안전하게 넣는다.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 대시보드 카드는 제목(이름) + 상태 뱃지가 한 줄을 나눠 써야 해서, 폭이 좁은 카드에서
// 이름이 길면 줄바꿈이 생기기 쉽다. 카드 안에서만 더 짧은 이름으로 줄여 쓰고,
// 실습실 상세 화면 제목·스위처 등 다른 곳은 원래 이름을 그대로 쓴다.
const DASHBOARD_NAME_OVERRIDES = {
  멀티미디어실: "멀티실",
  미디어실습실: "미디어실",
};
function dashboardLabName(name) {
  if (DASHBOARD_NAME_OVERRIDES[name]) return DASHBOARD_NAME_OVERRIDES[name];
  return name.startsWith("컴퓨터 ") ? `컴${name.slice(4)}` : name;
}

function renderLabCard({ lab, maintenance, failed, total, available, errorList, grade, closedReason }) {
  const cardName = dashboardLabName(lab.name);
  // 등급 · 이름 · 위치 · 상태(운영중/점검중 등)를 모두 한 줄에 담는다.
  // 뱃지에 숫자를 섞지 않고 항상 짧은 단어 하나만 쓰기 때문에, 위치가 붙어도 줄바꿈 없이 들어간다.
  const locationHtml = lab.location ? `<span class="lab-card__location-inline">📍 ${lab.location}</span>` : "";

  if (maintenance) {
    const note = closedReason ? escapeHtml(closedReason) : "리모델링 / 공사 중";
    return `
      <button class="lab-card lab-card--maintenance" data-lab-id="${lab.id}">
        <div class="lab-card__top">
          <div class="lab-card__title">
            ${gradeBadgeHtml(grade)}
            <span class="lab-card__name">${cardName}</span>
            ${locationHtml}
          </div>
          <span class="status-pill status-pill--maintenance">점검중</span>
        </div>
        <p class="lab-card__note">🚧 ${note}</p>
      </button>`;
  }

  if (failed) {
    return `
      <button class="lab-card lab-card--failed" data-lab-id="${lab.id}">
        <div class="lab-card__top">
          <div class="lab-card__title">
            ${gradeBadgeHtml(grade)}
            <span class="lab-card__name">${cardName}</span>
            ${locationHtml}
          </div>
          <span class="status-pill status-pill--unknown">확인 필요</span>
        </div>
        <p class="lab-card__note">⚠️ 데이터를 불러오지 못했습니다</p>
      </button>`;
  }

  const errorCount = errorList.length;
  // 고장난 자리가 있어도, 한 학급(CLASS_CAPACITY)이 앉을 좌석은 충분히 남아있으면
  // 상단 상태는 "운영중"으로 두고, "고장 n대"는 카드 맨 아랫줄에 따로 적는다.
  // 남은 좌석이 정원보다 부족할 때만 상단 상태 자체를 "고장"으로 바꾼다.
  // (어떤 자리가 고장인지는 세부 번호 대신 개수만 보여주고, 자세한 건 실습실에 들어가서 확인한다)
  const hasEnoughForClass = available >= CLASS_CAPACITY;
  const showAsNormal = errorCount === 0 || hasEnoughForClass;
  const pillClass = showAsNormal ? "status-pill--normal" : "status-pill--error";
  const pillText = showAsNormal ? "운영중" : "고장";
  const ratio = total > 0 ? Math.round((available / total) * 100) : 0;

  return `
    <button class="lab-card" data-lab-id="${lab.id}">
      <div class="lab-card__top">
        <div class="lab-card__title">
          ${gradeBadgeHtml(grade)}
          <span class="lab-card__name">${cardName}</span>
          ${locationHtml}
        </div>
        <span class="status-pill ${pillClass}">${pillText}</span>
      </div>
      <div class="lab-card__meter"><div class="lab-card__meter-fill" style="width:${ratio}%"></div></div>
      <div class="lab-card__stats">
        <span>${available}/${total}석 사용 가능</span>
        ${errorCount > 0 ? `<span class="lab-card__error-list">고장 ${errorCount}대</span>` : ""}
      </div>
    </button>`;
}

// ----------------------------------------------------------
// 🖥️ 실습실 상세 화면
// ----------------------------------------------------------
function loadLab(lab) {
  clearActiveListeners();

  currentLabId = lab.id;
  activeLab = lab;
  // 이전 실습실의 담당자/사양/프로그램 정보가 잠깐이라도 새 실습실에 잘못 적용되지 않도록 먼저 비워둔다.
  // (곧 아래 onSnapshot들이 이 실습실의 실제 데이터로 다시 채운다)
  activeLabManagers = [];
  activeSpecs = {};
  activeGrade = "";
  activeClosed = false;
  activeClosedReason = "";
  activeProgramsData = [];
  updateLabAccessUI();
  renderSpecs();

  dashboardView.style.display = "none";
  labView.style.display = "block";

  labNameTextEl.textContent = lab.name;
  if (lab.location) {
    labLocationBadgeEl.textContent = `📍 ${lab.location}`;
    labLocationBadgeEl.hidden = false;
  } else {
    labLocationBadgeEl.hidden = true;
  }
  descEl.textContent = "";

  renderLabSwitcher(lab.id);

  // 좌석을 애초에 배치한 적 없는(rows/cols=0) 실습실은 점검 토글과 무관하게 항상 고정 안내만 보여준다.
  const isStructurallyEmpty = lab.rows === 0 && lab.cols === 0;

  editInfoBtn.onclick = async () => {
    if (!requireCanManage()) return;
    const newDesc = prompt("실습실에 대한 설명을 입력하세요:", descEl.textContent);
    if (newDesc === null) return;
    try {
      await setDoc(doc(db, "labs", lab.id), { description: newDesc }, { merge: true });
    } catch (error) {
      console.error("설명 저장 실패:", error);
      alert("설명을 저장하지 못했습니다: " + error.message);
    }
  };

  // 공사/고장 등으로 실습실 전체를 일시적으로 점검 중 상태로 바꾸는 토글.
  // 좌석 데이터는 그대로 남아있고, 화면 표시만 "점검 중" 안내로 바뀐다 (운영 재개 시 그대로 복원).
  toggleClosedBtn.onclick = async () => {
    if (!requireCanManage()) return;
    if (activeClosed) {
      if (!confirm(`${lab.name}의 점검/공사 처리를 해제하고 다시 운영 상태로 되돌릴까요?`)) return;
      try {
        await setDoc(doc(db, "labs", lab.id), { closed: false, closedReason: "" }, { merge: true });
      } catch (error) {
        console.error("점검 해제 실패:", error);
        alert("처리하지 못했습니다: " + error.message);
      }
    } else {
      const reason = prompt(
        `${lab.name}을(를) 점검/공사 중으로 표시합니다.\n` +
          "실습실 종합 현황과 이 화면에 안내 문구로 표시되며, 좌석 정보는 그대로 보관되었다가 운영을 재개하면 복원됩니다.\n" +
          "(사유는 비워둬도 됩니다. 예: 전체 리모델링 공사)",
        ""
      );
      if (reason === null) return; // 취소
      try {
        await setDoc(doc(db, "labs", lab.id), { closed: true, closedReason: reason.trim() }, { merge: true });
      } catch (error) {
        console.error("점검 처리 실패:", error);
        alert("처리하지 못했습니다: " + error.message);
      }
    }
  };

  // 좌석 리스너 — 점검 중에는 해제했다가, 운영을 재개하면 다시 연결한다.
  let seatsUnsub = null;

  // 1. 실습실 설명 & 시간표(시점) & 담당 선생님 & 사양 정보 & 점검 상태 구독
  const unsubDesc = onSnapshot(
    doc(db, "labs", lab.id),
    (docSnapshot) => {
      const data = docSnapshot.exists() ? docSnapshot.data() : {};
      descEl.textContent = data.description || "";
      activeNoticeText = data.notice || "";
      activeLabManagers = data.managers || [];
      activeSpecs = data.specs || {};
      activeGrade = data.grade || "";
      activeClosed = data.closed === true;
      activeClosedReason = data.closedReason || "";
      updateLabAccessUI();
      renderNotice(lab, activeNoticeText);
      renderTimeSlots(lab, data.timeSlots || {});
      renderSpecs();

      if (isStructurallyEmpty) return; // 3번에서 고정 안내를 이미 표시했으므로 여기선 손대지 않는다.

      if (activeClosed) {
        // 점검 중으로 바뀌면 좌석 리스너를 끊고 안내 박스로 교체한다 (좌석 데이터는 그대로 남아있음).
        if (seatsUnsub) {
          seatsUnsub();
          seatsUnsub = null;
        }
        seatGridEl.style.display = "block";
        seatGridEl.innerHTML = `
          <div class="maintenance-box">
            <span class="maintenance-icon">🚧</span>
            <h3>실습실 전체 점검/공사 중</h3>
          </div>`;
        const reasonEl = document.createElement("p");
        if (activeClosedReason) {
          reasonEl.textContent = activeClosedReason;
        } else {
          reasonEl.innerHTML = "현재 이 실습실은 이용하실 수 없습니다.<br>관리자에게 문의해주세요.";
        }
        seatGridEl.querySelector(".maintenance-box").appendChild(reasonEl);
      } else if (!seatsUnsub) {
        // 처음 들어왔거나, 점검이 해제되어 다시 운영 중으로 바뀌었을 때 좌석 그리드를 (다시) 구독한다.
        seatGridEl.style.display = "grid";
        seatGridEl.style.gridTemplateColumns = `repeat(${lab.cols}, 1fr)`;

        seatsUnsub = onSnapshot(
          collection(db, `labs/${lab.id}/seats`),
          (snapshot) => {
            const seatsData = [];
            snapshot.forEach((docSnap) => seatsData.push(docSnap.data()));
            seatsData.sort((a, b) => a.id - b.id);

            const totalNeeded = lab.rows * lab.cols;
            if (seatsData.length < totalNeeded) {
              ensureSeatsExist(lab, seatsData.length, totalNeeded);
              return; // 배치 쓰기가 끝나면 스냅샷이 다시 발생해 이 함수가 재실행된다.
            }

            renderSeatGrid(lab, seatsData, totalNeeded);
          },
          (error) => console.error("좌석 정보 구독 오류:", error)
        );
        activeUnsubscribers.push(seatsUnsub);
      }
    },
    (error) => console.error("실습실 정보 구독 오류:", error)
  );
  activeUnsubscribers.push(unsubDesc);

  // 2. 설치 프로그램 목록 구독 (등록된 순서대로 표시)
  const unsubPrograms = onSnapshot(
    query(collection(db, `labs/${lab.id}/programs`), orderBy("addedAt", "asc")),
    (snapshot) => {
      activeProgramsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPrograms();
    },
    (error) => console.error("프로그램 목록 구독 오류:", error)
  );
  activeUnsubscribers.push(unsubPrograms);

  // 3. 좌석을 애초에 배치한 적 없는 실습실은 점검 토글과 무관하게 항상 고정 안내만 표시한다.
  if (isStructurallyEmpty) {
    seatGridEl.style.display = "block";
    seatGridEl.innerHTML = `
      <div class="maintenance-box">
        <span class="maintenance-icon">🚧</span>
        <h3>실습실 전체 수리 중</h3>
        <p>현재 이 실습실은 이용하실 수 없습니다.<br>관리자에게 문의해주세요.</p>
      </div>`;
  }
}

// 스위처는 가로 폭이 좁아 "컴퓨터" 접두어를 떼어내 최대한 많은 실습실이 한 번에 보이게 한다.
// (예: "컴퓨터 1실" → "1실", "미디어실습실"처럼 접두어가 없는 이름은 그대로 둔다)
function shortLabName(name) {
  return name.startsWith("컴퓨터 ") ? name.slice(4) : name;
}

function renderLabSwitcher(activeLabId) {
  labSwitcherEl.innerHTML = labs
    .map((lab) => {
      const state = labStatusCache.get(lab.id) || "unknown";
      const activeClass = lab.id === activeLabId ? "switcher-pill--active" : "";
      return `
        <button class="switcher-pill switcher-pill--${state} ${activeClass}" data-lab-id="${lab.id}">
          ${shortLabName(lab.name)}
        </button>`;
    })
    .join("");

  labSwitcherEl.querySelectorAll(".switcher-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.labId === activeLabId) return;
      const lab = labs.find((l) => l.id === btn.dataset.labId);
      if (lab) goToLab(lab);
    });
  });
}

// ----------------------------------------------------------
// 📢 전달사항 (교육정보부/전체관리자 공지)
// 좌석·시점·설명과 달리 실습실 담당 선생님은 "보기"만 가능하고, 등록/수정은
// 전체관리자만 할 수 있다. (canManageActiveLab()이 아니라 getIsSuperAdmin()으로 gating)
// ----------------------------------------------------------
function renderNotice(lab, noticeText) {
  const canEditNotice = getIsSuperAdmin();
  noticeEl.innerHTML = "";

  if (!noticeText) {
    if (!canEditNotice) {
      noticeEl.hidden = true;
      return;
    }
    // 전체관리자에게는 전달사항을 새로 등록할 수 있는 자리를 항상 보여준다.
    noticeEl.hidden = false;
    noticeEl.className = "lab-notice lab-notice--empty";
    const addBtn = document.createElement("button");
    addBtn.className = "lab-notice__add";
    addBtn.textContent = "+ 전달사항 추가";
    addBtn.addEventListener("click", () => editNotice(lab, ""));
    noticeEl.appendChild(addBtn);
    return;
  }

  noticeEl.hidden = false;
  noticeEl.className = "lab-notice";

  const icon = document.createElement("span");
  icon.className = "lab-notice__icon";
  icon.textContent = "📢";

  const text = document.createElement("p");
  text.className = "lab-notice__text";
  text.textContent = noticeText;

  noticeEl.appendChild(icon);
  noticeEl.appendChild(text);

  if (canEditNotice) {
    const editBtn = document.createElement("button");
    editBtn.className = "lab-notice__edit";
    editBtn.title = "전달사항 수정";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => editNotice(lab, noticeText));
    noticeEl.appendChild(editBtn);
  }
}

async function editNotice(lab, currentText) {
  if (!requireSuperAdmin()) return;
  const newText = prompt(
    "이 실습실에 전달할 공지사항을 입력하세요.\n예: AS 접수 완료, 9/12(금) 처리 예정\n(비워두고 저장하면 삭제됩니다)",
    currentText
  );
  if (newText === null) return; // 취소

  try {
    await setDoc(doc(db, "labs", lab.id), { notice: newText.trim() }, { merge: true });
  } catch (error) {
    console.error("전달사항 저장 실패:", error);
    alert("전달사항을 저장하지 못했습니다: " + error.message);
  }
}

// ----------------------------------------------------------
// 🖥️ 실습실 사양 (좌석 상태와 같은 등급 — 전체관리자 + 해당 실습실 담당 선생님도 입력 가능)
// ----------------------------------------------------------
function renderSpecs() {
  // 사양 목록 "앞에서" 한눈에 보이도록, 사양 카드 제목 옆에 등급 배지를 함께 표시한다.
  if (activeGrade) {
    specGradeBadgeEl.hidden = false;
    specGradeBadgeEl.className = `grade-badge grade-badge--${activeGrade.charAt(0)}`;
    specGradeBadgeEl.textContent = activeGrade;
  } else {
    specGradeBadgeEl.hidden = true;
  }

  specsListEl.innerHTML = "";

  const entries = SPEC_FIELDS.map(({ key, label }) => ({
    label,
    value: (activeSpecs[key] || "").trim(),
  })).filter((entry) => entry.value);

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "등록된 사양 정보가 없습니다.";
    specsListEl.appendChild(p);
    return;
  }

  entries.forEach(({ label, value }) => {
    const row = document.createElement("div");
    row.className = "spec-row";

    const labelEl = document.createElement("span");
    labelEl.className = "spec-row__label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "spec-row__value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    specsListEl.appendChild(row);
  });
}

editSpecsBtn.addEventListener("click", () => {
  if (!requireCanManage()) return;
  specGradeSelect.value = activeGrade || "";
  SPEC_FIELDS.forEach(({ key }) => {
    const input = document.getElementById(`spec-${key}`);
    if (input) input.value = activeSpecs[key] || "";
  });
  specsModal.classList.remove("hidden");
});

specsCancelBtn.addEventListener("click", () => {
  specsModal.classList.add("hidden");
});

specsSaveBtn.addEventListener("click", async () => {
  if (!requireCanManage()) return;

  const newSpecs = {};
  SPEC_FIELDS.forEach(({ key }) => {
    const input = document.getElementById(`spec-${key}`);
    newSpecs[key] = input ? input.value.trim() : "";
  });
  const newGrade = specGradeSelect.value; // "" | "S" ~ "F"

  try {
    await setDoc(doc(db, "labs", currentLabId), { specs: newSpecs, grade: newGrade }, { merge: true });
    specsModal.classList.add("hidden");
  } catch (error) {
    console.error("사양 정보 저장 실패:", error);
    alert("사양 정보를 저장하지 못했습니다: " + error.message);
  }
});

// ----------------------------------------------------------
// 💾 설치 프로그램 (좌석 상태와 같은 등급 — 담당 선생님도 추가·삭제 가능)
// ----------------------------------------------------------
function renderPrograms() {
  const canManage = canManageActiveLab();
  programsListEl.innerHTML = "";

  if (activeProgramsData.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "등록된 프로그램이 없습니다.";
    programsListEl.appendChild(p);
    return;
  }

  activeProgramsData.forEach(({ id, name }) => {
    const chip = document.createElement("span");
    chip.className = "program-chip";

    const label = document.createElement("span");
    label.textContent = name;
    chip.appendChild(label);

    if (canManage) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "program-chip__remove";
      removeBtn.title = "목록에서 삭제";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => deleteProgram(id, name));
      chip.appendChild(removeBtn);
    }

    programsListEl.appendChild(chip);
  });
}

addProgramBtn.addEventListener("click", async () => {
  if (!requireCanManage()) return;
  const name = prompt("설치한 프로그램 이름을 입력하세요.\n예: Visual Studio Code, 한글 2020, 파이썬 3.11");
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  try {
    await addDoc(collection(db, `labs/${currentLabId}/programs`), {
      name: trimmed,
      addedBy: getUserEmail() || "알 수 없음",
      addedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("프로그램 등록 실패:", error);
    alert("프로그램을 등록하지 못했습니다: " + error.message);
  }
});

async function deleteProgram(programId, name) {
  if (!requireCanManage()) return;
  if (!confirm(`"${name}"을(를) 목록에서 삭제할까요?`)) return;

  try {
    await deleteDoc(doc(db, `labs/${currentLabId}/programs`, programId));
  } catch (error) {
    console.error("프로그램 삭제 실패:", error);
    alert("삭제하지 못했습니다: " + error.message);
  }
}

function renderTimeSlots(lab, slots) {
  timeSlotRowEl.innerHTML = "";

  for (let i = 1; i <= 4; i++) {
    const slotText = slots[i] || "클릭하여 입력";
    const isEmpty = !slots[i];

    const slotDiv = document.createElement("div");
    slotDiv.className = "time-slot";
    slotDiv.innerHTML = `
      <span class="slot-label">${i}시점</span>
      <div class="slot-desc ${isEmpty ? "empty" : ""}">${slotText}</div>`;

    slotDiv.addEventListener("click", async () => {
      if (!requireCanManage()) return;
      const newText = prompt(`${i}시점의 용도를 입력하세요:`, slots[i] || "");
      if (newText === null) return;
      try {
        await setDoc(doc(db, "labs", lab.id), { timeSlots: { ...slots, [i]: newText } }, { merge: true });
      } catch (error) {
        console.error("시점 정보 저장 실패:", error);
        alert("저장하지 못했습니다: " + error.message);
      }
    });

    timeSlotRowEl.appendChild(slotDiv);
  }
}

/**
 * 좌석 문서가 실습실 정원(rows*cols)보다 적을 때 부족한 만큼 생성한다.
 * writeBatch로 한 번에 커밋하고, 실습실별 진행 플래그로 중복 실행을 막는다.
 */
async function ensureSeatsExist(lab, existingCount, totalNeeded) {
  if (seedingInProgress.has(lab.id)) return;
  seedingInProgress.add(lab.id);

  try {
    const batch = writeBatch(db);
    for (let i = existingCount + 1; i <= totalNeeded; i++) {
      batch.set(doc(db, `labs/${lab.id}/seats`, `pos_${i}`), {
        id: i,
        isHidden: false,
        status: "normal",
        issue: "",
        isSubstituted: false,
        substituteNote: "",
      });
    }
    await batch.commit();
  } catch (error) {
    console.error("좌석 초기화 실패:", error);
  } finally {
    seedingInProgress.delete(lab.id);
  }
}

function renderSeatGrid(lab, seatsData, totalNeeded) {
  seatGridEl.innerHTML = "";
  let displayCounter = 1;

  seatsData.forEach((seat) => {
    if (seat.id > totalNeeded) return; // 정원 축소 후 남아있는 옛 좌석 문서는 무시

    const seatDiv = document.createElement("div");

    if (seat.isHidden) {
      seatDiv.className = "seat hidden-seat";
      seatDiv.addEventListener("click", () => {
        if (!requireCanManage()) return;
        openModal(seat, 0);
      });
    } else {
      seatDiv.className = `seat ${seat.status === "normal" ? "normal" : "error"}`;
      seatDiv.innerHTML = `
        <div class="seat-icon">🖥️</div>
        <div class="seat-num">${displayCounter}번</div>
        <div class="issue-text">${seat.issue || "정상"}</div>`;

      // 고장난 건 아니지만(정상/고장과는 별개로), 여분 장비로 임시 교체된 좌석은 대개 원래보다
      // 낮은 사양일 가능성이 높으므로 "가급적 비권장"이라는 의도를 함께 전달한다.
      // (빨간 "고장"만큼 다급하게 보이지 않도록, 문구와 은은한 주황 톤으로만 표시)
      if (seat.isSubstituted) {
        seatDiv.classList.add("substituted");
        const noteEl = document.createElement("div");
        noteEl.className = "seat-substitute-note";
        noteEl.textContent = "⚠️ 가급적 비권장 · " + (seat.substituteNote || "장비 교체됨");
        seatDiv.appendChild(noteEl);
      }

      const currentNum = displayCounter;
      seatDiv.addEventListener("click", () => {
        if (!requireCanManage()) return;
        openModal(seat, currentNum);
      });
      displayCounter++;
    }

    seatGridEl.appendChild(seatDiv);
  });
}

// ----------------------------------------------------------
// 🗳️ 좌석 상태 변경 모달
// ----------------------------------------------------------
function buildIssueOptionsHtml(seatData) {
  if (seatData.isHidden) {
    return `<option value="${RESTORE_OPTION.value}">${RESTORE_OPTION.label}</option>`;
  }
  const normalOptions = ISSUE_OPTIONS.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join("");
  return normalOptions + `<option value="${HIDDEN_OPTION.value}">${HIDDEN_OPTION.label}</option>`;
}

function openModal(seatData, displayNum) {
  currentDocId = seatData.id;
  modal.classList.remove("hidden");

  modalTitle.textContent = seatData.isHidden ? "빈 공간 설정" : `좌석 상태 변경 (${displayNum}번)`;
  issueSelect.innerHTML = buildIssueOptionsHtml(seatData);

  // "장비 임시 교체"는 빈 자리 설정과는 무관한 개념이라, 빈 자리를 다룰 때는 아예 숨긴다.
  if (seatData.isHidden) {
    substituteFieldEl.hidden = true;
  } else {
    substituteFieldEl.hidden = false;
    substituteCheckbox.checked = !!seatData.isSubstituted;
    substituteNoteInput.value = seatData.substituteNote || "";
    substituteNoteInput.hidden = !substituteCheckbox.checked;
  }
}

substituteCheckbox.addEventListener("change", () => {
  substituteNoteInput.hidden = !substituteCheckbox.checked;
  if (substituteCheckbox.checked) substituteNoteInput.focus();
});

document.getElementById("cancel-btn").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("save-btn").addEventListener("click", async () => {
  if (!requireCanManage()) return;

  const issueValue = issueSelect.value;
  const issueText = issueSelect.options[issueSelect.selectedIndex]?.text || "";
  const docRef = doc(db, `labs/${currentLabId}/seats`, `pos_${currentDocId}`);

  // 장비 교체 여부는 상태(정상/고장) 선택과 별개의 체크박스이므로 따로 읽어온다.
  // 빈 자리로 만들거나(비우기) 빈 자리를 복구할 때는 의미가 없으므로 항상 초기화한다.
  const isSubstituted = !substituteFieldEl.hidden && substituteCheckbox.checked;
  const substituteNote = isSubstituted ? substituteNoteInput.value.trim() : "";

  let payload;
  if (issueValue === HIDDEN_OPTION.value) {
    payload = { id: currentDocId, isHidden: true, status: "normal", issue: "", isSubstituted: false, substituteNote: "" };
  } else if (issueValue === RESTORE_OPTION.value) {
    payload = { id: currentDocId, isHidden: false, status: "normal", issue: "", isSubstituted: false, substituteNote: "" };
  } else {
    const newStatus = issueValue === "normal" ? "normal" : "error";
    payload = {
      id: currentDocId,
      isHidden: false,
      status: newStatus,
      issue: newStatus === "normal" ? "" : issueText,
      isSubstituted,
      substituteNote,
    };
  }

  try {
    await setDoc(docRef, payload);
    modal.classList.add("hidden");
  } catch (error) {
    console.error("좌석 상태 저장 실패:", error);
    alert("저장하지 못했습니다: " + error.message);
  }
});

// ----------------------------------------------------------
// 👩‍🏫 실습실 담당자 배정 (전체관리자 전용)
// ----------------------------------------------------------
let labManagersMap = new Map(); // labId -> string[]
let teacherRoster = []; // [{ name, email }] - settings/teacher_roster에 미리 등록해둔 선생님 명단
let assignTargetLabId = null; // 담당자 지정 모달이 현재 다루고 있는 실습실 id
// 명단에 없는 이메일로(예: 예전에 직접 입력해) 이미 배정되어 있던 담당자.
// 화면에는 더 이상 편집 UI를 보여주지 않지만, 저장할 때 실수로 해제되지 않도록 그대로 들고 있는다.
let assignExtraEmails = [];

manageTeachersBtn.addEventListener("click", openTeacherModal);
closeTeacherModalBtn.addEventListener("click", () => {
  teacherModal.classList.add("hidden");
});

async function openTeacherModal() {
  if (!getIsSuperAdmin()) {
    alert("전체관리자만 담당자를 배정할 수 있습니다.");
    return;
  }

  teacherModal.classList.remove("hidden");
  teacherListEl.innerHTML = '<p class="loading-msg">불러오는 중입니다... ⏳</p>';

  try {
    // labs 컬렉션을 한 번에 조회해 실습실별 개별 조회(최대 16회)를 피한다.
    // (설명/시점/전달사항을 한 번도 설정하지 않은 실습실은 문서 자체가 없을 수 있으므로,
    //  아래 renderTeacherList에서는 정적 목록인 labs-data.js의 labs를 기준으로 순회한다.)
    const [snapshot] = await Promise.all([getDocs(collection(db, "labs")), loadTeacherRoster()]);
    labManagersMap = new Map();
    snapshot.forEach((docSnap) => {
      labManagersMap.set(docSnap.id, docSnap.data().managers || []);
    });
    // 담당자 전용 공지 기능을 처음 추가한 시점에는 settings/lab_managers 집계 문서가
    // 아직 없을 수 있으므로, 관리 화면을 열 때마다 한 번씩 동기화해 기존 배정도 즉시 반영한다.
    // (조용히 실행 — 실패해도 화면을 여는 것뿐이므로 알림을 띄우지 않는다)
    syncLabManagersAggregate(true);
  } catch (error) {
    console.error("담당자 명단 로딩 실패:", error);
    teacherListEl.innerHTML = '<p class="loading-msg">불러오지 못했습니다. 다시 시도해주세요.</p>';
    return;
  }

  renderTeacherList();
}

function renderTeacherList() {
  const nameByEmail = new Map(teacherRoster.map((t) => [t.email.toLowerCase(), t.name]));

  teacherListEl.innerHTML = labs
    .map((lab) => {
      const managers = labManagersMap.get(lab.id) || [];
      // 명단에 등록된 이메일은 이름으로, 명단에 없는(직접 입력했던) 이메일은 그대로 보여준다.
      const managerText =
        managers.length > 0
          ? managers.map((email) => nameByEmail.get(email.toLowerCase()) || email).join(", ")
          : "지정된 담당자 없음";
      const emptyClass = managers.length > 0 ? "" : "teacher-row__emails--empty";
      return `
        <div class="teacher-row">
          <div class="teacher-row__name">${lab.name}</div>
          <div class="teacher-row__emails ${emptyClass}">${managerText}</div>
          <button class="teacher-row__edit" data-lab-id="${lab.id}">편집</button>
        </div>`;
    })
    .join("");

  teacherListEl.querySelectorAll(".teacher-row__edit").forEach((btn) => {
    btn.addEventListener("click", () => editLabManagers(btn.dataset.labId));
  });
}

// ----------------------------------------------------------
// 📇 선생님 명단 (settings/teacher_roster) — 이름 ↔ 이메일 미리 등록
// ----------------------------------------------------------
async function loadTeacherRoster() {
  try {
    const snap = await getDoc(doc(db, "settings", "teacher_roster"));
    const list = snap.exists() ? snap.data().teachers || [] : [];
    teacherRoster = list.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
  } catch (error) {
    console.error("선생님 명단 로딩 실패:", error);
    teacherRoster = [];
  }
}

manageRosterBtn.addEventListener("click", openRosterModal);
closeRosterModalBtn.addEventListener("click", () => rosterModal.classList.add("hidden"));

function openRosterModal() {
  rosterModal.classList.remove("hidden");
  rosterNameInput.value = "";
  rosterEmailInput.value = "";
  rosterBulkInput.value = "";
  renderRosterList();
}

function renderRosterList() {
  rosterListEl.innerHTML = "";

  if (teacherRoster.length === 0) {
    const p = document.createElement("p");
    p.className = "roster-empty-hint";
    p.textContent = "등록된 선생님이 없습니다. 위에서 이름과 이메일을 입력해 추가하세요.";
    rosterListEl.appendChild(p);
    return;
  }

  teacherRoster.forEach((teacher, idx) => {
    const row = document.createElement("div");
    row.className = "roster-row";

    const nameEl = document.createElement("span");
    nameEl.className = "roster-row__name";
    nameEl.textContent = teacher.name;

    const emailEl = document.createElement("span");
    emailEl.className = "roster-row__email";
    emailEl.textContent = teacher.email;

    const delBtn = document.createElement("button");
    delBtn.className = "roster-row__delete";
    delBtn.title = "명단에서 삭제";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => deleteRosterEntry(idx));

    row.appendChild(nameEl);
    row.appendChild(emailEl);
    row.appendChild(delBtn);
    rosterListEl.appendChild(row);
  });
}

addRosterBtn.addEventListener("click", async () => {
  const name = rosterNameInput.value.trim();
  const email = rosterEmailInput.value.trim().toLowerCase();
  if (!name || !email) {
    alert("이름과 이메일을 모두 입력하세요.");
    return;
  }
  if (teacherRoster.some((t) => t.email.toLowerCase() === email)) {
    alert("이미 등록된 이메일입니다.");
    return;
  }

  const updated = [...teacherRoster, { name, email }].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  try {
    await setDoc(doc(db, "settings", "teacher_roster"), { teachers: updated });
    teacherRoster = updated;
    rosterNameInput.value = "";
    rosterEmailInput.value = "";
    renderRosterList();
  } catch (error) {
    console.error("선생님 명단 저장 실패:", error);
    alert("추가하지 못했습니다: " + error.message);
  }
});

/**
 * 구글 시트에서 "이름[탭]이메일" 형태로 복사해 붙여넣은 여러 줄의 텍스트를 파싱한다.
 * 탭뿐 아니라 쉼표로 구분한 경우도 지원하고, 이메일(@ 포함)이 없는 줄은
 * (예: 시트의 머리글 줄 "이름 / 이메일") 조용히 건너뛴다.
 */
function parseBulkRosterInput(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const name = (parts[0] || "").trim();
      const email = (parts[1] || "").trim().toLowerCase();
      return { name, email };
    })
    .filter((entry) => entry.name && entry.email.includes("@"));
}

addRosterBulkBtn.addEventListener("click", async () => {
  const parsed = parseBulkRosterInput(rosterBulkInput.value);
  if (parsed.length === 0) {
    alert("추가할 내용이 없습니다. 이름과 이메일을 탭이나 쉼표로 구분해 한 줄에 한 명씩 붙여넣어주세요.");
    return;
  }

  const existingEmails = new Set(teacherRoster.map((t) => t.email.toLowerCase()));
  const added = [];
  let duplicateCount = 0;

  parsed.forEach((entry) => {
    if (existingEmails.has(entry.email)) {
      duplicateCount++;
      return;
    }
    existingEmails.add(entry.email);
    added.push(entry);
  });

  if (added.length === 0) {
    alert(`추가할 새 항목이 없습니다. (${duplicateCount}명은 이미 등록되어 있습니다)`);
    return;
  }

  const updated = [...teacherRoster, ...added].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  try {
    await setDoc(doc(db, "settings", "teacher_roster"), { teachers: updated });
    teacherRoster = updated;
    rosterBulkInput.value = "";
    renderRosterList();
    alert(
      `${added.length}명을 추가했습니다.` + (duplicateCount > 0 ? `\n(이미 등록되어 있던 ${duplicateCount}명은 건너뛰었습니다)` : "")
    );
  } catch (error) {
    console.error("선생님 명단 일괄 저장 실패:", error);
    alert("일괄 추가하지 못했습니다: " + error.message);
  }
});

async function deleteRosterEntry(idx) {
  const target = teacherRoster[idx];
  if (!target) return;
  if (
    !confirm(`"${target.name}"을(를) 명단에서 삭제할까요?\n(이미 배정되어 있는 실습실 담당자에서는 자동으로 해제되지 않습니다)`)
  ) {
    return;
  }

  const updated = teacherRoster.filter((_, i) => i !== idx);
  try {
    await setDoc(doc(db, "settings", "teacher_roster"), { teachers: updated });
    teacherRoster = updated;
    renderRosterList();
  } catch (error) {
    console.error("선생님 명단 삭제 실패:", error);
    alert("삭제하지 못했습니다: " + error.message);
  }
}

// ----------------------------------------------------------
// ✅ 담당자 지정 모달 (명단에서 이름으로 선택 + 명단에 없는 이메일 직접 추가)
// ----------------------------------------------------------
function editLabManagers(labId) {
  const lab = labs.find((l) => l.id === labId);
  if (!lab) return;

  assignTargetLabId = labId;
  assignModalTitle.textContent = `${lab.name} 담당자 지정`;

  const current = labManagersMap.get(labId) || [];
  const currentSet = new Set(current.map((e) => e.toLowerCase()));
  renderAssignList(currentSet);

  // 명단에 없는 이메일로(예: 예전에 직접 입력해) 이미 배정되어 있던 담당자는 화면에
  // 보여주지 않지만, 저장할 때 실수로 해제되지 않도록 그대로 기억해둔다.
  const rosterEmails = new Set(teacherRoster.map((t) => t.email.toLowerCase()));
  assignExtraEmails = current.filter((email) => !rosterEmails.has(email.toLowerCase()));

  assignSearchInput.value = "";
  assignModal.classList.remove("hidden");
}

function renderAssignList(currentSet) {
  assignListEl.innerHTML = "";

  if (teacherRoster.length === 0) {
    const p = document.createElement("p");
    p.className = "roster-empty-hint";
    p.textContent = '등록된 선생님이 없습니다. "선생님 명단 관리"에서 먼저 추가해주세요.';
    assignListEl.appendChild(p);
    return;
  }

  teacherRoster.forEach((teacher) => {
    const row = document.createElement("label");
    row.className = "assign-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = teacher.email;
    checkbox.checked = currentSet.has(teacher.email.toLowerCase());

    const nameEl = document.createElement("span");
    nameEl.className = "assign-row__name";
    nameEl.textContent = teacher.name;

    const emailEl = document.createElement("span");
    emailEl.className = "assign-row__email";
    emailEl.textContent = teacher.email;

    row.appendChild(checkbox);
    row.appendChild(nameEl);
    row.appendChild(emailEl);
    assignListEl.appendChild(row);
  });
}

/** 담당자 지정 모달의 이름 검색창 — 명단이 길어도 입력한 글자가 이름·이메일에 포함된 항목만 남긴다. */
function filterAssignList(searchText) {
  const term = searchText.trim().toLowerCase();
  const rows = assignListEl.querySelectorAll(".assign-row");
  let anyVisible = false;

  rows.forEach((row) => {
    const name = row.querySelector(".assign-row__name").textContent.toLowerCase();
    const email = row.querySelector(".assign-row__email").textContent.toLowerCase();
    const match = !term || name.includes(term) || email.includes(term);
    row.style.display = match ? "" : "none";
    if (match) anyVisible = true;
  });

  let emptyHint = assignListEl.querySelector(".assign-search-empty");
  if (rows.length > 0 && !anyVisible) {
    if (!emptyHint) {
      emptyHint = document.createElement("p");
      emptyHint.className = "roster-empty-hint assign-search-empty";
      emptyHint.textContent = "검색 결과가 없습니다.";
      assignListEl.appendChild(emptyHint);
    }
  } else if (emptyHint) {
    emptyHint.remove();
  }
}

assignSearchInput.addEventListener("input", () => filterAssignList(assignSearchInput.value));

closeAssignModalBtn.addEventListener("click", () => assignModal.classList.add("hidden"));
assignCancelBtn.addEventListener("click", () => assignModal.classList.add("hidden"));

assignSaveBtn.addEventListener("click", async () => {
  if (!assignTargetLabId) return;

  const checkedEmails = Array.from(assignListEl.querySelectorAll('input[type="checkbox"]:checked')).map(
    (cb) => cb.value
  );

  const merged = Array.from(new Set([...checkedEmails, ...assignExtraEmails]));
  const labId = assignTargetLabId;

  try {
    await setDoc(doc(db, "labs", labId), { managers: merged }, { merge: true });
    labManagersMap.set(labId, merged);
    renderTeacherList();
    assignModal.classList.add("hidden");
    await syncLabManagersAggregate();
  } catch (error) {
    console.error("담당자 저장 실패:", error);
    alert("담당자를 저장하지 못했습니다: " + error.message);
  }
});

/**
 * settings/lab_managers 문서에 "어떤 실습실이든 담당 중인 모든 선생님 이메일"을 모아 저장한다.
 * Firestore 보안 규칙은 다른 문서(예: 담당자 전용 공지)를 읽을 권한을 검사할 때 실습실 16개를
 * 일일이 조회할 수 없으므로, 이 집계 문서 하나만 보고 "이 사람이 어떤 실습실이든 담당자인가?"를
 * 판단할 수 있도록 담당자가 바뀔 때마다 이 함수로 동기화해둔다.
 * (labManagersMap은 담당자 관리 화면을 열 때 모든 실습실 기준으로 이미 채워져 있으므로,
 *  여기서는 방금 수정한 값이 반영된 최신 상태를 그대로 합치기만 하면 된다.)
 */
async function syncLabManagersAggregate(silent = false) {
  const allEmails = new Set();
  labManagersMap.forEach((emails) => emails.forEach((email) => allEmails.add(email)));
  try {
    await setDoc(doc(db, "settings", "lab_managers"), { emails: Array.from(allEmails) });
  } catch (error) {
    console.error("담당자 전체 명단 동기화 실패:", error);
    if (!silent) {
      alert(
        "담당자는 저장되었지만, 전체 명단 동기화에 실패했습니다: " + error.message +
          "\n담당자 전용 공지 열람 권한이 즉시 반영되지 않을 수 있습니다."
      );
    }
  }
}

// ----------------------------------------------------------
// 시작: 대시보드부터 표시
// ----------------------------------------------------------
loadDashboardData();