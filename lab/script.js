// ==========================================================
// 🏫 실습실 관리 시스템 - 메인 로직
// ==========================================================
import {
  collection,
  doc,
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
import { labs, ISSUE_OPTIONS, HIDDEN_OPTION, RESTORE_OPTION, SPEC_FIELDS, CLASS_CAPACITY } from "./labs-data.js";

// ----------------------------------------------------------
// DOM 참조
// ----------------------------------------------------------
const dashboardView = document.getElementById("dashboard-view");
const labView = document.getElementById("lab-view");
const brandBtn = document.getElementById("brand-btn");
const backBtn = document.getElementById("back-btn");

const kpiRowEl = document.getElementById("kpi-row");
const labGridEl = document.getElementById("lab-grid");

const labSwitcherEl = document.getElementById("lab-switcher");
const noticeEl = document.getElementById("lab-notice");
const timeSlotRowEl = document.getElementById("time-slot-row");
const seatGridEl = document.getElementById("seat-grid");
const labNameTextEl = document.getElementById("lab-name-text");
const managerBadgeEl = document.getElementById("manager-badge");
const descEl = document.getElementById("current-lab-desc");
const editInfoBtn = document.getElementById("edit-info-btn");

const modal = document.getElementById("modal");
const modalTitle = document.querySelector("#modal .modal-content h3");
const issueSelect = document.getElementById("issue-select");

const manageTeachersBtn = document.getElementById("manage-teachers-btn");
const teacherModal = document.getElementById("teacher-modal");
const teacherListEl = document.getElementById("teacher-list");
const closeTeacherModalBtn = document.getElementById("close-teacher-modal-btn");

const specsListEl = document.getElementById("specs-list");
const editSpecsBtn = document.getElementById("edit-specs-btn");
const specsModal = document.getElementById("specs-modal");
const specsCancelBtn = document.getElementById("specs-cancel-btn");
const specsSaveBtn = document.getElementById("specs-save-btn");

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

/** 로그인한 사용자가 전체관리자가 아니면, 담당 중인 실습실이 있는지 확인해 상단 표시를 갱신한다. */
async function updateManagerHeaderLabel(isSuperAdmin) {
  if (isSuperAdmin) return; // 전체관리자 표시는 auth.js가 이미 처리함
  const email = getUserEmail();
  if (!email) return; // 로그아웃 상태 (auth.js가 이미 "로그인이 필요합니다"로 표시함)

  try {
    const snap = await getDocs(query(collection(db, "labs"), where("managers", "array-contains", email)));
    if (snap.empty) return; // 담당 실습실이 없으면 이름만 표시된 상태를 유지 (게스트)
    if (getUserEmail() !== email) return; // 조회하는 동안 로그아웃/재로그인 등으로 상태가 바뀌었으면 무시

    const managedNames = snap.docs
      .map((docSnap) => labs.find((lab) => lab.id === docSnap.id))
      .filter(Boolean)
      .map((lab) => shortLabName(lab.name));
    if (managedNames.length === 0) return;

    const baseName = userInfoEl.textContent; // auth.js가 이미 넣어둔 순수 이름
    userInfoEl.textContent = `${managedNames.join("·")} 관리자 · ${baseName}`;
  } catch (error) {
    console.error("담당 실습실 확인 중 오류:", error);
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
      if (lab.rows === 0 && lab.cols === 0) {
        labStatusCache.set(lab.id, "maintenance");
        return { lab, maintenance: true };
      }
      try {
        const snapshot = await getDocs(collection(db, `labs/${lab.id}/seats`));
        let total = 0;
        let available = 0;
        const errorList = [];

        snapshot.forEach((docSnap) => {
          const seat = docSnap.data();
          if (seat.isHidden) return; // 빈 공간은 좌석 수에서 제외
          total++;
          if (seat.status === "normal") {
            available++;
          } else {
            errorList.push(seat.id);
          }
        });
        errorList.sort((a, b) => a - b);

        labStatusCache.set(lab.id, errorList.length > 0 ? "error" : "normal");
        return { lab, total, available, errorList };
      } catch (error) {
        console.error(`${lab.name} 현황 로딩 실패:`, error);
        labStatusCache.set(lab.id, "unknown");
        return { lab, failed: true };
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

function renderLabCard({ lab, maintenance, failed, total, available, errorList }) {
  if (maintenance) {
    return `
      <button class="lab-card lab-card--maintenance" data-lab-id="${lab.id}">
        <div class="lab-card__top">
          <span class="lab-card__name">${lab.name}</span>
          <span class="status-pill status-pill--maintenance">점검중</span>
        </div>
        <p class="lab-card__note">🚧 리모델링 / 공사 중</p>
      </button>`;
  }

  if (failed) {
    return `
      <button class="lab-card lab-card--failed" data-lab-id="${lab.id}">
        <div class="lab-card__top">
          <span class="lab-card__name">${lab.name}</span>
          <span class="status-pill status-pill--unknown">확인 필요</span>
        </div>
        <p class="lab-card__note">⚠️ 데이터를 불러오지 못했습니다</p>
      </button>`;
  }

  const errorCount = errorList.length;
  // 고장난 자리가 있어도, 한 학급(CLASS_CAPACITY)이 앉을 좌석은 충분히 남아있으면
  // "정상 운영"은 그대로 두고 옆에 "고장 n대"만 작게 덧붙인다.
  // 남은 좌석이 정원보다 부족할 때만 "고장 n"으로 전체 상태를 바꾼다.
  const hasEnoughForClass = available >= CLASS_CAPACITY;
  const showAsNormal = errorCount === 0 || hasEnoughForClass;
  const pillClass = showAsNormal ? "status-pill--normal" : "status-pill--error";
  const pillText = showAsNormal ? "정상 운영" : `고장 ${errorCount}`;
  const showWarningBadge = errorCount > 0 && showAsNormal;
  const ratio = total > 0 ? Math.round((available / total) * 100) : 0;

  return `
    <button class="lab-card" data-lab-id="${lab.id}">
      <div class="lab-card__top">
        <span class="lab-card__name">${lab.name}</span>
        <div class="lab-card__badges">
          <span class="status-pill ${pillClass}">${pillText}</span>
          ${showWarningBadge ? `<span class="status-pill status-pill--warning">고장 ${errorCount}대</span>` : ""}
        </div>
      </div>
      <div class="lab-card__meter"><div class="lab-card__meter-fill" style="width:${ratio}%"></div></div>
      <div class="lab-card__stats">
        <span>${available}/${total}석 사용 가능</span>
        ${errorCount > 0 ? `<span class="lab-card__error-list">${errorList.join(", ")}번</span>` : ""}
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
  activeProgramsData = [];
  updateLabAccessUI();
  renderSpecs();

  dashboardView.style.display = "none";
  labView.style.display = "block";

  labNameTextEl.textContent = lab.name;
  descEl.textContent = "";

  renderLabSwitcher(lab.id);

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

  // 1. 실습실 설명 & 시간표(시점) & 담당 선생님 & 사양 정보 구독
  const unsubDesc = onSnapshot(
    doc(db, "labs", lab.id),
    (docSnapshot) => {
      const data = docSnapshot.exists() ? docSnapshot.data() : {};
      descEl.textContent = data.description || "";
      activeNoticeText = data.notice || "";
      activeLabManagers = data.managers || [];
      activeSpecs = data.specs || {};
      updateLabAccessUI();
      renderNotice(lab, activeNoticeText);
      renderTimeSlots(lab, data.timeSlots || {});
      renderSpecs();
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

  // 3. 수리 중인 실습실은 좌석을 표시하지 않는다.
  if (lab.rows === 0 && lab.cols === 0) {
    seatGridEl.style.display = "block";
    seatGridEl.innerHTML = `
      <div class="maintenance-box">
        <span class="maintenance-icon">🚧</span>
        <h3>실습실 전체 수리 중</h3>
        <p>현재 이 실습실은 이용하실 수 없습니다.<br>관리자에게 문의해주세요.</p>
      </div>`;
    return;
  }

  // 4. 좌석 목록 구독
  seatGridEl.style.display = "grid";
  seatGridEl.style.gridTemplateColumns = `repeat(${lab.cols}, 1fr)`;

  const unsubSeats = onSnapshot(
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
  activeUnsubscribers.push(unsubSeats);
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

  try {
    await setDoc(doc(db, "labs", currentLabId), { specs: newSpecs }, { merge: true });
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
}

document.getElementById("cancel-btn").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("save-btn").addEventListener("click", async () => {
  if (!requireCanManage()) return;

  const issueValue = issueSelect.value;
  const issueText = issueSelect.options[issueSelect.selectedIndex]?.text || "";
  const docRef = doc(db, `labs/${currentLabId}/seats`, `pos_${currentDocId}`);

  let payload;
  if (issueValue === HIDDEN_OPTION.value) {
    payload = { id: currentDocId, isHidden: true, status: "normal", issue: "" };
  } else if (issueValue === RESTORE_OPTION.value) {
    payload = { id: currentDocId, isHidden: false, status: "normal", issue: "" };
  } else {
    const newStatus = issueValue === "normal" ? "normal" : "error";
    payload = { id: currentDocId, isHidden: false, status: newStatus, issue: newStatus === "normal" ? "" : issueText };
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
    const snapshot = await getDocs(collection(db, "labs"));
    labManagersMap = new Map();
    snapshot.forEach((docSnap) => {
      labManagersMap.set(docSnap.id, docSnap.data().managers || []);
    });
  } catch (error) {
    console.error("담당자 명단 로딩 실패:", error);
    teacherListEl.innerHTML = '<p class="loading-msg">불러오지 못했습니다. 다시 시도해주세요.</p>';
    return;
  }

  renderTeacherList();
}

function renderTeacherList() {
  teacherListEl.innerHTML = labs
    .map((lab) => {
      const managers = labManagersMap.get(lab.id) || [];
      const managerText = managers.length > 0 ? managers.join(", ") : "지정된 담당자 없음";
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

async function editLabManagers(labId) {
  const lab = labs.find((l) => l.id === labId);
  if (!lab) return;

  const current = labManagersMap.get(labId) || [];
  const input = prompt(
    `${lab.name}을(를) 관리할 선생님의 이메일을 쉼표(,)로 구분해 입력하세요.\n(비워두고 저장하면 담당자가 모두 해제됩니다)`,
    current.join(", ")
  );
  if (input === null) return; // 취소

  const emails = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await setDoc(doc(db, "labs", labId), { managers: emails }, { merge: true });
    labManagersMap.set(labId, emails);
    renderTeacherList();
  } catch (error) {
    console.error("담당자 저장 실패:", error);
    alert("담당자를 저장하지 못했습니다: " + error.message);
  }
}

// ----------------------------------------------------------
// 시작: 대시보드부터 표시
// ----------------------------------------------------------
loadDashboardData();