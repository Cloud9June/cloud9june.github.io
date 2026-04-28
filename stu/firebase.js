// ===== Firebase SDK =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, limit, startAfter, getDocs, getDoc,
  doc, deleteDoc, updateDoc, arrayRemove, getDocFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ===== Firebase 설정 =====
const firebaseConfig = {
  apiKey: "AIzaSyA_ufzFnMFovKW0JhNyrXWYV2a_1cCt5Vs",
  authDomain: "sungilnow.firebaseapp.com",
  projectId: "sungilnow",
  storageBucket: "sungilnow.appspot.com",
  messagingSenderId: "458932138557",
  appId: "1:458932138557:web:f1a508865261ffaafbf054"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

async function getUserPrivilege(email) {
  try {
    const snap = await getDoc(doc(db, "users", email));
    if (!snap.exists()) return [];
    const data = snap.data();
    if (Array.isArray(data.privilege)) return data.privilege;
    if (typeof data.privilege === "string")
      return data.privilege.split(",").map((p) => p.trim());
  } catch (err) {
    console.error("⚠️ 권한 조회 실패:", err);
  }
  return [];
}

let currentPrivileges = [];

// ===== DOM 요소 =====
const videoWrapper = document.getElementById("videoWrapper");
const appHeader = document.getElementById("appHeader");
const tabs = document.getElementById("tabs");
const mainContent = document.getElementById("mainContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const tabButtons = document.querySelectorAll(".tabs button");
const allFeed = document.getElementById("allFeed");
const classFeed = document.getElementById("classFeed");
const externalFeed = document.getElementById("externalFeed");
const helpFeed = document.getElementById("helpFeed");
const header = document.getElementById("appHeader");
const submitFeed = document.getElementById("submitFeed");
const writeFeedBtn = document.getElementById("writeFeedBtn");
const feedModal = document.getElementById("feedModal");
const cancelFeed = document.getElementById("cancelFeed");
const introLoading = document.getElementById("introLoading");
const welcomeText = document.getElementById("welcomeText");

// ===== 키오스크용 =====
const urlParams = new URLSearchParams(window.location.search);
const isKioskMode = urlParams.get("kiosk") === "true";

if (isKioskMode) {
  document.body.classList.add("kiosk-mode");
}

// ===== 전역 변수 =====
let lastDoc = null;   // 페이지네이션 포인터
let isLoading = false;
const PAGE_SIZE = 10;  // ✅ 한 번에 10개씩 불러오기

// ===== 유틸 =====
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function formatDate(date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function getMonthKeys(count = 2) {
  const now = new Date();
  const keys = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
function applyTabStyle(tabName) {
  mainContent.classList.remove("all-tab", "class-tab", "help-tab", "external-tab");
  header.classList.remove("blue-header", "pink-header", "purple-header", "green-header");
  mainContent.classList.remove("blue-border", "red-border", "purple-border", "green-border");

  if (tabName === "all") {
    mainContent.classList.add("all-tab", "blue-border");
    header.classList.add("blue-header");
  } else if (tabName === "class") {
    mainContent.classList.add("class-tab", "red-border");
    header.classList.add("pink-header");
  } else if (tabName === "help") {
    mainContent.classList.add("help-tab", "purple-border");
    header.classList.add("purple-header");
  } else if (tabName === "external") {
    mainContent.classList.add("external-tab", "green-border");
    header.classList.add("green-header");
  }
}

// ===== 권한 (Firestore 기반) =====

// 🔹 현재 로그인한 사용자의 권한은 로그인 시 getUserPrivilege()로 읽어서 currentPrivileges에 저장되어 있다고 가정
function canViewTab(user, tab) {
  const privileges = currentPrivileges ?? [];

  if (tab === "all") return true;
  if (tab === "external") return true;
  if (tab === "help") return true;

  if (tab === "class") {
    if (user.role === "교사" && privileges.includes("담임")) return true;
    if (user.role === "학생") return true;
  }
  return false;
}

function canWriteFeed(user, tab) {
  const privileges = currentPrivileges ?? [];

  if (privileges.includes("총관리자")) return true;
  if (tab === "all" && privileges.includes("관리자")) return true;
  if (tab === "external" && privileges.includes("관리자")) return true;
  if (tab === "class" && (privileges.includes("담임") || privileges.includes("반장") || privileges.includes("부반장")))
    return true;

  return false;
}

function canDeleteFeed(user, tab) {
  const privileges = currentPrivileges ?? [];

  if (privileges.includes("총관리자")) return true;
  if (tab === "all" && privileges.includes("관리자")) return true;
  if (tab === "external" && privileges.includes("관리자")) return true;
  if (tab === "class" && (privileges.includes("담임") || privileges.includes("반장") || privileges.includes("부반장")))
    return true;

  return false;
}

// ✅ 링크 자동 변환 함수 (이 부분 추가)
function makeLinksClickable(text) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const trustedDomains = [
    "docs.google.com",
    "drive.google.com",
    "forms.gle",
    "sites.google.com",
    "spreadsheets.google.com"
  ];

  return text.replace(urlPattern, (url) => {
    const isTrusted = trustedDomains.some(domain => url.includes(domain));

    if (isTrusted) {
      // ✅ 표시 텍스트를 "(링크)"로 통일
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="feed-link">(링크)</a>`;
    } else {
      // ❌ 비신뢰 도메인은 그냥 텍스트로 표시
      return `<span class="untrusted-link">${url}</span>`;
    }
  });
}

// ===== 피드 초기화 =====
function clearFeed() { allFeed.innerHTML = ""; }
function clearClassFeed() { classFeed.innerHTML = ""; }

// ===== 피드 렌더링 =====
function renderFeedItem(id, item, tab = "all") {
  let feedEl;
  if (tab === "all") feedEl = document.getElementById("allFeed");
  else if (tab === "class") feedEl = document.getElementById("classFeed");
  else if (tab === "external") feedEl = document.getElementById("externalFeed");
  
  const createdAt = item.createdAt?.toDate
    ? formatDate(item.createdAt.toDate())
    : formatDate(new Date());

  const div = document.createElement("div");
  div.className = "feed-item";
  div.setAttribute("data-id", id);
  div.setAttribute("data-tags", (item.tags || []).join(" "));

  const user = JSON.parse(localStorage.getItem("userInfo"));

  // ✅ 버튼 구성
  let actionBtns = "";
  const canEdit = user && canWriteFeed(user, tab);
  const canDelete = user && canDeleteFeed(user, tab);

  // ✅ 체크 버튼 (우리반 탭 + 중요 피드 + 학생 번호 있을 때만)
  let checkBtnHTML = "";
  if (tab === "class" && item.important && user?.number) {
    const checkedFeeds = JSON.parse(localStorage.getItem("checkedFeeds") || "[]");
    const isChecked = checkedFeeds.includes(id);

    // ✅ 이미 확인한 피드라면 disabled 처리
    const disabledAttr = isChecked ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : "";

    checkBtnHTML = `<button class="check-feed-btn" data-id="${id}" data-tab="${tab}" ${disabledAttr}>v</button>`;
  }

  if (canEdit || canDelete) {
    // 🔹 권한 있는 사용자 → 체크(조건 만족 시) + 수정 + 삭제
    actionBtns += checkBtnHTML;
    if (canEdit) {
      actionBtns += `<button 
          class="edit-feed-btn" 
          data-id="${id}" 
          data-tab="${tab}"
          data-title="${item.title}" 
          data-content="${item.content}">✏️</button>`;
    }
    if (canDelete) {
      actionBtns += `<button class="delete-feed-btn" data-id="${id}" data-tab="${tab}">×</button>`;
    }
  } else {
    // 🔹 권한 없는 사용자 → 체크 버튼만 (조건 만족 시)
    if (checkBtnHTML) {
      // solo 전용 클래스 추가 (체크 버튼만 있는 경우)
      actionBtns += checkBtnHTML.replace(
        'class="check-feed-btn"',
        'class="check-feed-btn solo"'
      );
    }
  }

  // ✅ 태그 HTML (전체탭 스타일 재사용)
  let tagHTML = "";
  if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
    tagHTML = `
      <div class="feed-tags">
        ${item.tags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join(" ")}
      </div>
    `;
  }

  // ✅ 우리반 탭에서만, 중요 피드일 경우 번호 표시
  let studentHTML = "";
  if (tab === "class" && item.important) {
    if (Array.isArray(item.students) && item.students.length > 0) {
      const studentList = item.students
        .map(num => `<span class="tag">${num}</span>`)
        .join(" ");
      studentHTML = `
        <div class="feed-tags">
          ${studentList}
        </div>
      `;
    } else {
      studentHTML = `
        <div class="feed-tags">
          <span class="tag" style="color:#2e7d32;">학생 모두 확인함.</span>
        </div>
      `;
    }
  }

  const contentHTML = makeLinksClickable(item.content || "");

  div.innerHTML = `
    ${actionBtns}
    <div class="feed-title">${item.title}</div>
    <div class="feed-meta">${item.author || "작성자 미상"} · ${formatDate(item.createdAt?.toDate?.() || new Date())}</div>
    <div class="feed-content">${contentHTML}</div>
    ${studentHTML}  <!-- 🟩 중요 피드 학생번호 (우리반 전용) -->
    ${tagHTML}      <!-- 🟦 기존 태그 -->
  `;

  feedEl.appendChild(div);
}

// ===== 피드 불러오기 =====
let lastDocAll = null;
let lastDocClass = null;
let lastDocExternal = null;
let isLoadingAll = false;
let isLoadingClass = false;
let isLoadingExternal = false;

async function loadFeeds(initial = false) {
  if (isLoadingAll) return;
  isLoadingAll = true;

  try {
    const monthKeys = getMonthKeys(2); // 10월 + 9월
    let feeds = [];

    if (initial) {
      const queries = monthKeys.map(key =>
        query(collection(db, "feeds", key, "items"), orderBy("createdAt", "desc"))
      );
      const snaps = await Promise.all(queries.map(q => getDocs(q)));

      snaps.forEach(snap => {
        snap.forEach(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate?.() || new Date(0);
          feeds.push({ id: doc.id, data, createdAt });
        });
      });

      // ✅ createdAt 기준 정렬 (전월/당월 섞여도 정확)
      feeds.sort((a, b) => b.createdAt - a.createdAt);

      // ✅ 중복 제거 (혹시 동일 ID가 겹칠 경우 대비)
      const unique = new Map();
      feeds.forEach(f => unique.set(f.id, f));
      feeds = [...unique.values()];

      clearFeed();
      feeds.forEach(f => renderFeedItem(f.id, f.data, "all"));

      // ✅ 마지막 포인터는 최신 달 기준으로 갱신
      const latestSnap = snaps[0];
      if (!latestSnap.empty) {
        lastDocAll = latestSnap.docs[latestSnap.docs.length - 1];
      }

    } else {
      // 무한스크롤: 이번 달만
      const q = query(
        collection(db, "feeds", monthKeys[0], "items"),
        orderBy("createdAt", "desc"),
        startAfter(lastDocAll),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      snap.forEach(doc => renderFeedItem(doc.id, doc.data(), "all"));
      if (!snap.empty) lastDocAll = snap.docs[snap.docs.length - 1];
    }
  } catch (err) {
    console.error("피드 로딩 오류:", err);
  } finally {
    isLoadingAll = false;
  }
}


async function loadClassFeeds(user, initial = true) {
  if (isLoadingClass) return;
  isLoadingClass = true;
  try {
    const classKey = `${user.grade}-${user.class}`;
    const monthKeys = getMonthKeys(2); // ✅ 이번 달 + 지난달 (필요 시 getMonthKeys(3)로 확장)

    let snaps = [];

    if (initial) {
      // ✅ 초기 로딩: 여러 달 한꺼번에 불러오기
      const queries = monthKeys.map(key =>
        query(
          collection(db, "classFeeds", classKey, `feeds_${key}`),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        )
      );

      // ✅ 캐시 무시하고 항상 서버에서 새로 불러오기
      snaps = await Promise.all(queries.map(q => getDocs(q, { source: "server" })));

    } else {
      // ✅ 무한 스크롤: 이번 달만 추가 로딩
      const q = query(
        collection(db, "classFeeds", classKey, `feeds_${monthKeys[0]}`),
        orderBy("createdAt", "desc"),
        startAfter(lastDocClass),
        limit(PAGE_SIZE)
      );

      // ✅ 캐시 무시하고 서버에서 직접 불러오기
      const snap = await getDocs(q, { source: "server" });
      snaps = [snap];
    }

    if (initial) clearClassFeed();

    snaps.forEach((snap, idx) => {
      snap.forEach(doc => {
        if (!document.querySelector(`[data-id="${doc.id}"]`)) {
          renderFeedItem(doc.id, doc.data(), "class");
        }
      });
    });

    // ✅ 페이지네이션 포인터는 이번 달만 기준
    const currentSnap = snaps[0];
    if (!currentSnap.empty) {
      lastDocClass = currentSnap.docs[currentSnap.docs.length - 1];
    }
  } catch (err) {
    console.error("우리반 피드 로딩 오류:", err);
  } finally {
    isLoadingClass = false;
  }
}


async function loadExternalFeeds(initial = false) {
  if (isLoadingExternal) return;
  isLoadingExternal = true;

  try {
    let q;
    if (initial || !lastDocExternal) {
      // 첫 로딩
      q = query(
        collection(db, "externalFeeds"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );
    } else {
      // 다음 페이지
      q = query(
        collection(db, "externalFeeds"),
        orderBy("createdAt", "desc"),
        startAfter(lastDocExternal),
        limit(PAGE_SIZE)
      );
    }

    const snap = await getDocs(q);

    if (initial) {
      document.getElementById("externalFeed").innerHTML = "";
    }

    snap.forEach(doc => {
      renderFeedItem(doc.id, doc.data(), "external");
    });

    // 마지막 문서 기억
    if (!snap.empty) {
      lastDocExternal = snap.docs[snap.docs.length - 1];
    }
  } catch (err) {
    console.error("대외 피드 로딩 오류:", err);
  } finally {
    isLoadingExternal = false;
  }
}

// ===== 무한 스크롤 =====
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    const currentTab = document.querySelector(".tabs button.active").dataset.tab;
    if (currentTab === "all") loadFeeds(false);
    if (currentTab === "class") {
      const savedUser = JSON.parse(localStorage.getItem("userInfo"));
      if (savedUser) loadClassFeeds(savedUser, false);
    }
    if (currentTab === "external") { loadExternalFeeds(false); }
  }
});

// ===== 피드 저장 =====
async function saveFeed(title, content, user, tab, isImportant = false) {
  const monthKey = getCurrentMonthKey();
  let colRef;

  if (tab === "all") {
    colRef = collection(db, "feeds", monthKey, "items");
  } else if (tab === "external") {
    colRef = collection(db, "externalFeeds");
  } else {
    const classKey = `${user.grade}-${user.class}`;
    colRef = collection(db, "classFeeds", classKey, `feeds_${monthKey}`);
  }

  // ✅ 중요 피드일 경우: 시트에서 해당 반 학생 번호 불러오기
  let studentNumbers = [];
  if (
    isImportant &&
    Array.isArray(currentPrivileges) &&
    currentPrivileges.some(p => ["담임", "반장", "부반장"].includes(p))
  ) {
    try {
      const response = await fetch(
        `https://script.google.com/macros/s/AKfycbzZiT5CBT1Bl1vlRRlpBzsJSpssH3Lmd3VgekQnUER36U5d5GcdQn5bZsWr-MIpfCAB9w/exec?grade=${user.grade}&class=${user.class}`
      );
      const data = await response.json();
      if (data.success && Array.isArray(data.students)) {
        studentNumbers = data.students;
      }
    } catch (err) {
      console.error("학생 목록 불러오기 실패:", err);
    }
  }

  // ✅ Firestore에 저장
  await addDoc(colRef, {
    title,
    content,
    createdAt: serverTimestamp(),
    author: user.displayName,
    authorEmail: user.email,
    important: isImportant, // 중요 여부 저장
    students: studentNumbers // 중요 피드면 반 학생 번호 목록 저장
  });
}

// ===== 피드 등록/수정 =====
submitFeed.addEventListener("click", async () => {
  const mode = feedModal.dataset.mode;
  const feedId = feedModal.dataset.id;
  const title = document.getElementById("feedTitle").value.trim();
  const content = document.getElementById("feedContent").value.trim();
  const isImportant = document.getElementById("importantCheck").checked; // ✅ 중요 체크 여부
  const user = JSON.parse(localStorage.getItem("userInfo"));
  const currentTab = document.querySelector(".tabs button.active").dataset.tab;

  if (!title || !content) {
    alert("제목과 내용을 모두 입력해주세요.");
    return;
  }

  // ✅ 버튼 잠금 (중복 클릭 방지)
  submitFeed.disabled = true;
  submitFeed.textContent = "등록 중... ⏳";

  try {
    // ✅ 피드 새로 등록
    if (mode === "create") {
      // ✅ 태그 입력값 처리
      const tagInputValue = document.getElementById("tagInput")?.value.trim() || "";
      const tags = tagInputValue
        .split(" ")
        .filter(tag => tag.startsWith("#") && tag.length > 1);

      // ✅ 중요 피드일 경우 학생 번호 목록 가져오기
      let studentNumbers = [];
      const privileges = Array.isArray(user.privilege)
        ? user.privilege
        : currentPrivileges || []; // 🔹 Firestore 기반 권한까지 함께 확인

      if (
        isImportant &&
        Array.isArray(privileges) &&
        privileges.some(p => ["담임", "반장", "부반장"].includes(p))
      ) {
        try {
          const response = await fetch(
            `https://script.google.com/macros/s/AKfycbzZiT5CBT1Bl1vlRRlpBzsJSpssH3Lmd3VgekQnUER36U5d5GcdQn5bZsWr-MIpfCAB9w/exec?grade=${user.grade}&class=${user.class}`
          );
          const data = await response.json();
          if (data.success && Array.isArray(data.students)) {
            studentNumbers = data.students;
            console.log("🟢 학생 번호 불러오기 완료:", studentNumbers);
          } else {
            console.warn("⚠️ Apps Script 응답 이상:", data);
          }
        } catch (err) {
          console.error("❌ 학생 번호 불러오기 오류:", err);
        }
      }

      // ✅ Firestore에 저장
      const monthKey = getCurrentMonthKey();
      let colRef;
      if (currentTab === "all") {
        colRef = collection(db, "feeds", monthKey, "items");
      } else if (currentTab === "external") {
        colRef = collection(db, "externalFeeds");
      } else {
        const classKey = `${user.grade}-${user.class}`;
        colRef = collection(db, "classFeeds", classKey, `feeds_${monthKey}`);
      }

      await addDoc(colRef, {
        title,
        content,
        tags,
        createdAt: serverTimestamp(),
        author: user.displayName,
        authorEmail: user.email,
        important: isImportant,
        students: studentNumbers.length > 0 ? studentNumbers : [],
      });

      alert("피드가 등록되었습니다!");

      // ✅ 등록 후 즉시 반영
      if (currentTab === "all") {
        loadFeeds(true);
      } else if (currentTab === "class") {
        loadClassFeeds(user, true);
      } else if (currentTab === "external") {
        loadExternalFeeds(true);
      }
    // ✅ 피드 수정
    } else if (mode === "edit") {
      const monthKey = getCurrentMonthKey();
      let docRef;

      if (currentTab === "all") {
        docRef = doc(db, "feeds", monthKey, "items", feedId);
      } else if (currentTab === "class") {
        const classKey = `${user.grade}-${user.class}`;
        docRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);
      } else if (currentTab === "external") {
        docRef = doc(db, "externalFeeds", feedId);
      }

      // ✅ 태그 입력값 처리
      const tagInputValue = document.getElementById("tagInput")?.value.trim() || "";
      const tags = tagInputValue
        .split(" ")
        .filter(tag => tag.startsWith("#") && tag.length > 1);

      console.log("🟩 피드 수정:", { feedId, title, tags, isImportant });

      // ✅ 중요 체크 시 학생 목록 가져오기
      let studentNumbers = [];
      if (
        isImportant &&
        currentTab === "class" &&
        Array.isArray(user.privilege) &&
        user.privilege.some(p => ["담임", "반장", "부반장"].includes(p))
      ) {
        try {
          console.log("🟩 중요 피드로 변경됨 → 학생 목록 불러오기...");
          const response = await fetch(
            `https://script.google.com/macros/s/AKfycbzZiT5CBT1Bl1vlRRlpBzsJSpssH3Lmd3VgekQnUER36U5d5GcdQn5bZsWr-MIpfCAB9w/exec?grade=${user.grade}&class=${user.class}`
          );
          const data = await response.json();
          if (data.success && Array.isArray(data.students)) {
            studentNumbers = data.students;
            console.log("🟩 학생번호 로드 완료:", studentNumbers);
          } else {
            console.warn("⚠️ Apps Script 응답 이상:", data);
          }
        } catch (err) {
          console.error("❌ 학생 목록 불러오기 실패:", err);
        }
      }

      // ✅ Firestore 업데이트
      const updateData = {
        title,
        content,
        tags,
        important: isImportant,
        updatedAt: serverTimestamp(),
      };

      // ✅ 중요 체크에 따른 students 필드 반영
      if (isImportant && studentNumbers.length > 0) {
        updateData.students = studentNumbers;
      } else if (!isImportant) {
        updateData.students = []; // 중요 해제 시 초기화
      }

      await updateDoc(docRef, updateData);

      // ✅ 화면 즉시 반영 (기존 방식 유지)
      const feedEl = document.querySelector(`.feed-item[data-id="${feedId}"]`);
      if (feedEl) {
        feedEl.querySelector(".feed-title").innerHTML = `
          ${title}
          <div class="feed-meta">${formatDate(new Date())} · ${user.displayName}</div>
        `;
        feedEl.querySelector(".feed-content").textContent = content;

        const tagHTML = tags.length
          ? `<div class="feed-tags">
              ${tags.map(t => `<span class="tag" data-tag="${t}">${t}</span>`).join(" ")}
            </div>`
          : "";
        const existingTags = feedEl.querySelector(".feed-tags");
        if (existingTags) {
          existingTags.outerHTML = tagHTML;
        } else if (tagHTML) {
          feedEl.insertAdjacentHTML("beforeend", tagHTML);
        }
      }

      console.log("🟩 수정 완료");
      alert("피드가 수정되었습니다!");
    }

    // ✅ 모달 닫기 및 초기화
    feedModal.style.display = "none";
    document.getElementById("feedTitle").value = "";
    document.getElementById("feedContent").value = "";
    document.getElementById("importantCheck").checked = false;
  } catch (err) {
    console.error("❌ 피드 저장 오류:", err);
    alert("저장에 실패했습니다.");
  } finally {
    // ✅ 버튼 다시 활성화
    submitFeed.disabled = false;
    submitFeed.textContent = "등록";
  }
});

// ===== 피드 수정 모드 =====
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-feed-btn")) {
    const feedId = e.target.dataset.id;
    const tab = e.target.dataset.tab;
    const tagArea = document.querySelector(".tag-area");
    const importantWrapper = document.getElementById("importantWrapper"); // ✅ 중요 체크박스 영역

    // ✅ 전체 탭일 때만 태그 입력창 보이기
    if (tab === "all") {
      tagArea.style.display = "block";
    } else {
      tagArea.style.display = "none";
    }

    // ✅ 우리반 탭일 때만 중요 체크박스 표시
    if (tab === "class") {
      importantWrapper.style.display = "flex";
    } else {
      importantWrapper.style.display = "none";
    }

    // ✅ Firestore에서 해당 피드 문서 불러오기
    const monthKey = getCurrentMonthKey();
    let docRef;
    if (tab === "all") {
      docRef = doc(db, "feeds", monthKey, "items", feedId);
    } else if (tab === "class") {
      const user = JSON.parse(localStorage.getItem("userInfo"));
      const classKey = `${user.grade}-${user.class}`;
      docRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);
    } else if (tab === "external") {
      docRef = doc(db, "externalFeeds", feedId);
    }

    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // ✅ 모달 기본 설정
        document.querySelector("#feedModal h2").textContent = "피드 수정";
        document.getElementById("submitFeed").textContent = "수정 완료";

        // ✅ 기존 값 입력창에 반영
        document.getElementById("feedTitle").value = data.title || "";
        document.getElementById("feedContent").value = data.content || "";
        document.getElementById("tagInput").value = (data.tags || []).join(" ");

        // ✅ 중요 여부 반영
        const importantCheck = document.getElementById("importantCheck");
        if (importantCheck) {
          importantCheck.checked = !!data.important; // 중요 여부 상태 복원
        }
      }
    });

    // ✅ 모달 모드 정보 세팅
    feedModal.style.display = "flex";
    feedModal.dataset.mode = "edit";
    feedModal.dataset.id = feedId;
    feedModal.dataset.tab = tab;
  }
});


// ===== 피드 삭제 =====
document.body.addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-feed-btn")) {
    const feedId = e.target.dataset.id;
    const tab = e.target.dataset.tab;
    const monthKey = getCurrentMonthKey();
    const user = JSON.parse(localStorage.getItem("userInfo"));
    if (!confirm("정말 이 피드를 삭제하시겠습니까?")) return;
    try {
      let docRef;
      if (tab === "all") {
        docRef = doc(db, "feeds", monthKey, "items", feedId);
      } else if (tab === "class") {
        const classKey = `${user.grade}-${user.class}`;
        docRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);
      } else if (tab === "external") {
        docRef = doc(db, "externalFeeds", feedId); // ✅ external 처리 추가
      }

      await deleteDoc(docRef);

      // ✅ 화면에서도 제거
      e.target.closest(".feed-item").remove();
      alert("피드가 삭제되었습니다.");

      // ✅ 삭제 직후 새로고침 (external은 특히 권장)
      if (tab === "all") {
        loadFeeds(true);
      } else if (tab === "class") {
        loadClassFeeds(user, true);
      } else if (tab === "external") {
        loadExternalFeeds(true);
      }
    } catch (err) {
      console.error("삭제 오류:", err);
      alert("삭제에 실패했습니다.");
    }
  }
});

// ===== 화면 전환 =====
function showMainScreen(userInfo, displayName) {
  videoWrapper.style.display = "none";
  appHeader.style.display = "block";
  tabs.style.display = "flex";
  mainContent.style.display = "block";
  
  // ✅ 키오스크 모드에서는 이름 대신 학교명 고정
  if (isKioskMode) {
    document.getElementById("userInfo").textContent = "성일정보고등학교";
  } else {
    document.getElementById("userInfo").textContent = displayName;
  }

  const savedTab = localStorage.getItem("activeTab") || "all";

  // ✅ 탭 버튼 active 적용
  tabButtons.forEach(t => t.classList.remove("active"));
  const activeBtn = document.querySelector(`[data-tab="${savedTab}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // ✅ 스크롤 맨 위로 이동
  window.scrollTo({ top: 0, behavior: "instant" });

  // ✅ 피드 초기화
  clearFeed();
  clearClassFeed();

  // ✅ 모든 피드 영역 숨기기
  allFeed.style.display = "none";
  classFeed.style.display = "none";
  externalFeed.style.display = "none";
  helpFeed.style.display = "none";

  // ✅ 저장된 탭에 맞는 피드 보이기 & 로드
  if (savedTab === "all") {
    allFeed.style.display = "block";
    lastDocAll = null;
    loadFeeds(true);
  } else if (savedTab === "class") {
    classFeed.style.display = "block";
    lastDocClass = null;
    const savedUser = JSON.parse(localStorage.getItem("userInfo"));
    if (savedUser) loadClassFeeds(savedUser, true);
  } else if (savedTab === "help") {
    helpFeed.style.display = "block";
    renderHelpFeed();
  } else if (savedTab === "external") {
    externalFeed.style.display = "block";
    lastDocExternal = null;
    loadExternalFeeds(true);
  }

  // ✅ 헤더/보더 스타일 적용
  applyTabStyle(savedTab);

  // 학급 없는 사용자일 경우 "우리반" 숨김
  if (!userInfo.grade || !userInfo.class) {
    document.querySelector('[data-tab="class"]').style.display = "none";
  }
}


function updateUI(user) {
  const writeBtn = document.querySelector(".write-feed-btn");
  const currentTab = document.querySelector(".tabs button.active").dataset.tab;

  document.querySelector('[data-tab="all"]').style.display = "inline-block";

  if (canViewTab(user, "class")) {
    document.querySelector('[data-tab="class"]').style.display = "inline-block";
  } else {
    document.querySelector('[data-tab="class"]').style.display = "none";
  }

  document.querySelector('[data-tab="external"]').style.display = "inline-block";
  document.querySelector('[data-tab="help"]').style.display = "inline-block";

  writeBtn.style.display = canWriteFeed(user, currentTab) ? "flex" : "none";
}

// ===== 게스트 입장 =====
const guestLink = document.getElementById("guestLink");
if (guestLink) {
  guestLink.addEventListener("click", (e) => {
    e.preventDefault();

    // 🔹 게스트 모드 설정
    localStorage.setItem("isLoggedIn", "guest");
    localStorage.setItem("userInfo", JSON.stringify({
      displayName: "게스트 모드",
      role: "게스트",
      grade: "",
      class: ""
    }));

    // 🔹 인트로 숨기기
    videoWrapper.style.display = "none";

    // 🔹 메인 화면 보이기
    appHeader.style.display = "block";
    tabs.style.display = "flex";
    mainContent.style.display = "block";

    // 🔹 상단 표시
    document.getElementById("userInfo").textContent = "게스트 모드";

    // 🔹 로그아웃 버튼 숨기기
    document.getElementById("logoutBtn").style.display = "none";

    // 🔹 피드쓰기 버튼 숨기기
    writeFeedBtn.style.display = "none";

    // 🔹 대외 탭만 표시
    document.querySelectorAll('#tabs button').forEach(btn => {
      if (btn.dataset.tab !== 'external') btn.style.display = 'none';
      else btn.classList.add('active');
    });

    // 🔹 피드 영역 제어
    allFeed.style.display = "none";
    classFeed.style.display = "none";
    helpFeed.style.display = "none";
    externalFeed.style.display = "block";

    // ✅ 안내문 중복 방지
    if (!document.getElementById("guestNotice")) {
      const notice = document.createElement("div");
      notice.id = "guestNotice";
      notice.classList.add("notice-banner"); // ✅ 스타일은 CSS에서 관리
      notice.innerHTML = `<a id="goLogin" href="#" class="login-link">로그인하러 돌아가기</a>`;
      mainContent.prepend(notice);

      // ✅ "로그인" 클릭 시 로그인 화면 복귀
      document.getElementById("goLogin").addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userInfo");

        // 메인 숨기고 인트로로 전환
        appHeader.style.display = "none";
        tabs.style.display = "none";
        mainContent.style.display = "none";
        videoWrapper.style.display = "block";
        loginBtn.style.display = "inline-block";
        welcomeText.style.display = "block";

        // ✅ 기존 안내문 제거
        const existingNotice = document.getElementById("guestNotice");
        if (existingNotice) existingNotice.remove();
      });
    }

    // 🔹 헤더 스타일 적용
    applyTabStyle("external");

    // 🔹 첫 대외 피드 로드
    loadExternalFeeds(true);

    // ✅ 무한스크롤 활성화 (게스트 전용)
    window.onscroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        !isLoadingExternal
      ) {
        loadExternalFeeds(false);
      }
    };
  });
}

// ===== 로그인 =====
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email;

    // ✅ 학교 계정 검증
    if (!email.endsWith("@sungil-i.kr")) {
      alert("학교 계정(@sungil-i.kr)으로만 로그인 가능합니다.");
      await signOut(auth);
      return;
    }

    // ✅ Firestore에서 권한 가져오기
    currentPrivileges = await getUserPrivilege(email);
    console.log("🔥 불러온 권한:", currentPrivileges);

    // ✅ 로그인 시에는 항상 전체 탭부터 시작
    localStorage.setItem("activeTab", "all");

    welcomeText.style.display = "none";
    loginBtn.style.display = "none";
    guestLink.style.display = "none";
    introLoading.style.display = "flex";

    // ✅ Apps Script 호출 (URL은 새로 발급받은 Web App URL로 유지)
    const response = await fetch(
      `https://script.google.com/macros/s/AKfycbzZiT5CBT1Bl1vlRRlpBzsJSpssH3Lmd3VgekQnUER36U5d5GcdQn5bZsWr-MIpfCAB9w/exec?email=${email}`
    );
    const data = await response.json();

    if (!data.success) {
      alert("시트에서 사용자를 찾을 수 없습니다.");
      await signOut(auth);
      return;
    }

    const userInfo = data.user;

    // ✅ 이름 표시
    let displayName =
      userInfo.role === "교사"
        ? `${userInfo.name} 선생님`
        : `${userInfo.grade}학년 ${userInfo.class}반 ${userInfo.name}`;

    if (isKioskMode) {
      displayName = "성일정보고등학교";
    }

    // ✅ privilege가 문자열일 수도 있으므로 배열로 변환
    let privilegeArray = [];
    if (Array.isArray(userInfo.privilege)) {
      privilegeArray = userInfo.privilege;
    } else if (typeof userInfo.privilege === "string" && userInfo.privilege.includes(",")) {
      privilegeArray = userInfo.privilege.split(",").map(p => p.trim());
    } else if (typeof userInfo.privilege === "string" && userInfo.privilege.trim() !== "") {
      privilegeArray = [userInfo.privilege.trim()];
    }

    // ✅ 로컬스토리지 저장
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem(
      "userInfo",
      JSON.stringify({
        ...userInfo,
        displayName,
        role: userInfo.role || "",
        grade: userInfo.grade || "",
        class: userInfo.class || "",
        number: userInfo.number || "",
      })
    );

    // ✅ 메인 화면 표시
    showMainScreen(userInfo, displayName);
    updateUI({
      ...userInfo,
      privilege: privilegeArray,
    });

    // ✅ 게스트 모드 흔적 정리
    const guestNotice = document.querySelector("#mainContent div#guestNotice");
    if (guestNotice) guestNotice.remove(); // 안내문 삭제
    document.getElementById("logoutBtn").style.display = "inline-block"; // 로그아웃 버튼 복원

    // await requestAndSaveFCMToken(user.email);
  } catch (error) {
    console.error("로그인 오류:", error);
    alert("로그인 중 오류가 발생했습니다.");
  }
});

// ===== 로그아웃 =====
logoutBtn.addEventListener("click", async () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    await signOut(auth);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userInfo");
    location.reload();
  }
});

// ===== 새로고침 시 로그인 유지 =====
window.addEventListener("load", async () => {
  const savedUser = JSON.parse(localStorage.getItem("userInfo"));
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  if (isLoggedIn && savedUser) {
    document.getElementById("reloginLoading").style.display = "flex";

    // 🔹 Firestore에서 권한 다시 불러오기
    const email = savedUser.email;
    const privileges = await getUserPrivilege(email);
    console.log("🔁 새로고침 후 불러온 권한:", privileges);

    // ✅ 전역 변수에 다시 저장 (canViewTab / canWriteFeed에서 사용됨)
    currentPrivileges = privileges;

    // ✅ UI 업데이트는 권한 세팅 이후!
    await showMainScreen(savedUser, savedUser.displayName);
    updateUI({
      ...savedUser,
      privilege: privileges,
    });

    setTimeout(() => {
      document.getElementById("reloginLoading").style.display = "none";
    }, 600);
  } else {
    videoWrapper.style.display = "block";
  }
});

// ===== 탭 전환 =====
tabButtons.forEach(tab => {
  tab.addEventListener("click", () => {
    tabButtons.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const selectedTab = tab.dataset.tab;
    localStorage.setItem("activeTab", tab.dataset.tab);

    const importantWrapper = document.getElementById("importantWrapper");
    if (tab.dataset.tab === "class") {
      importantWrapper.style.display = "block";
    } else {
      importantWrapper.style.display = "none";
      document.getElementById("importantCheck").checked = false; // 탭 전환 시 체크 해제
    }

    isLoadingAll = false;
    isLoadingClass = false;
    isLoadingExternal = false;

    mainContent.classList.remove("all-tab", "class-tab", "external-tab", "help-tab");

    if (tab.dataset.tab === "all") {
      allFeed.style.display = "block";
      classFeed.style.display = "none";
      externalFeed.style.display = "none";
      helpFeed.style.display = "none";
      mainContent.classList.add("all-tab");
      mainContent.classList.add("blue-border");
      mainContent.classList.remove("red-border");
      mainContent.classList.remove("purple-border");
      mainContent.classList.remove("green-border");
      header.classList.add("blue-header");
      header.classList.remove("pink-header");
      header.classList.remove("green-header");
      header.classList.remove("purple-header");
      clearFeed();
      lastDocAll = null;
      loadFeeds(true);
    } else if (tab.dataset.tab === "class") {
      allFeed.style.display = "none";
      externalFeed.style.display = "none";
      helpFeed.style.display = "none";
      classFeed.style.display = "block";
      mainContent.classList.add("class-tab");
      mainContent.classList.add("red-border");
      mainContent.classList.remove("blue-border");
      mainContent.classList.remove("green-border");
      mainContent.classList.remove("purple-border");
      header.classList.add("pink-header");
      header.classList.remove("blue-header");
      header.classList.remove("green-header");
      header.classList.remove("purple-header");
      clearClassFeed();
      lastDocClass = null;
      const savedUser = JSON.parse(localStorage.getItem("userInfo"));
      if (savedUser) loadClassFeeds(savedUser, true);
    } else if (tab.dataset.tab === "external") {
      allFeed.style.display = "none";
      classFeed.style.display = "none";
      helpFeed.style.display = "none";
      externalFeed.style.display = "block";
      mainContent.classList.add("external-tab");
      mainContent.classList.add("green-border");
      mainContent.classList.remove("blue-border");
      mainContent.classList.remove("red-border");
      mainContent.classList.remove("purple-border");
      header.classList.add("green-header");
      header.classList.remove("blue-header");
      header.classList.remove("purple-header");
      header.classList.remove("pink-header");
      loadExternalFeeds(true);
    } else if (tab.dataset.tab === "help") {
      allFeed.style.display = "none";
      classFeed.style.display = "none";
      externalFeed.style.display = "none";
      helpFeed.style.display = "block";
      mainContent.classList.add("help-tab");
      mainContent.classList.add("purple-border");
      mainContent.classList.remove("blue-border");
      mainContent.classList.remove("red-border");
      mainContent.classList.remove("green-border");
      header.classList.add("purple-header");
      header.classList.remove("blue-header");
      header.classList.remove("green-header");
      header.classList.remove("pink-header");
      clearFeed();
      clearClassFeed();
      renderHelpFeed();
    }
    
    const savedUser = JSON.parse(localStorage.getItem("userInfo"));
    if (savedUser) updateUI(savedUser);

    document.getElementById("showAllFeedsBtn").style.display = "none";
  });
});

// ===== 글쓰기 버튼 & 모달 =====
writeFeedBtn.addEventListener("click", () => {
  document.querySelector("#feedModal h2").textContent = "새 피드 작성";
  document.getElementById("submitFeed").textContent = "등록";
  document.getElementById("feedTitle").value = "";
  document.getElementById("feedContent").value = "";

  const currentTab = document.querySelector(".tabs button.active").dataset.tab;
  const importantWrapper = document.getElementById("importantWrapper");
  const tagArea = document.querySelector(".tag-area"); // ✅ 추가된 태그 영역

  // ✅ tagArea가 없을 수도 있으니 안전하게 처리
  if (tagArea) {
    if (currentTab === "all") {
      tagArea.style.display = "block";
    } else {
      tagArea.style.display = "none";
    }
  }

  // ✅ “우리반” 탭일 때만 중요 체크박스 보이기
  if (currentTab === "class") {
    importantWrapper.style.display = "block";
  } else {
    importantWrapper.style.display = "none";
    document.getElementById("importantCheck").checked = false;
  }

  feedModal.style.display = "flex";
  feedModal.dataset.mode = "create";
});

cancelFeed.addEventListener("click", () => {
  feedModal.style.display = "none";
  document.getElementById("feedTitle").value = "";
  document.getElementById("feedContent").value = "";
});



const tagInput = document.getElementById("tagInput");
const tagSuggestions = document.getElementById("tagSuggestions");

// 기존 공개대상 태그 후보
const presetTags = [
  "#전교생공개",
  "#1학년만",
  "#2학년만",
  "#3학년만",
  "#뷰티스마트케어과",
  "#부사관과",
  "#금융경영과",
  "#회계정보과",
  "#창업마케팅과",
  "#AI게임콘텐츠과",
  "#스마트웹콘텐츠과",
  "#소프트웨어개발과"
];

// # 입력 시 추천창 표시
tagInput.addEventListener("input", (e) => {
  const value = e.target.value;
  const lastChar = value.slice(-1);

  if (lastChar === "#") {
    showSuggestions();
  } else {
    // 자동완성 단어를 입력 중일 때 (예: "#2" → "#2학년만")
    const currentWord = value.split(" ").pop();
    if (currentWord.startsWith("#")) {
      const filtered = presetTags.filter(tag => tag.includes(currentWord));
      if (filtered.length > 0) showSuggestions(filtered);
      else hideSuggestions();
    } else {
      hideSuggestions();
    }
  }
});

function showSuggestions(list = presetTags) {
  tagSuggestions.innerHTML = "";
  list.forEach(tag => {
    const div = document.createElement("div");
    div.textContent = tag;
    div.addEventListener("click", () => selectTag(tag));
    tagSuggestions.appendChild(div);
  });
  tagSuggestions.style.display = "block";
}

function hideSuggestions() {
  tagSuggestions.style.display = "none";
}

function selectTag(tag) {
  const currentValue = tagInput.value.trim();
  const parts = currentValue.split(" ");
  parts[parts.length - 1] = tag; // 마지막 단어(#...)를 선택된 태그로 대체
  tagInput.value = parts.join(" ") + " ";
  hideSuggestions();
}


const helpData = [{
    title: "설치 방법 (홈 화면 추가)",
    content: `안드로이드: 크롬 → 메뉴(⋮) → 홈 화면에 추가
iOS: Safari → 공유(⬆️) → 홈 화면에 추가
👉 운영체제/브라우저 버전에 따라 위치가 다를 수 있습니다.
✅ 무엇이 되었든 '홈 화면에 추가'만 찾으면 앱처럼 사용할 수 있습니다.
<br>
📱 <strong>QR코드로 바로 접속:</strong>
키오스크에서는 아래 QR코드를 스캔하면
스마트폰에서도 S:NOW를 바로 열 수 있습니다.
위의 안내를 따라 '홈 화면에 추가'를 하면
앱처럼 설치하여 사용할 수도 있습니다.<br>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://eduinfo.sungil-i.kr/stu" alt="S:NOW QR코드">
`,
    author: "S:NOW 도움말"
  },
  {
    title: "화면 설명",
    content: `전체 피드: 모든 학년/반 공지
우리반 피드: 로그인한 학년·반 전용
대외 피드: 게스트를 포함해 누구나 볼 수 있는 학교 소식
도움말: 이 안내문 보기`,
    author: "S:NOW 도움말"
  },
  { 
    title: "중요 피드 확인 기능", 
    content: `📢 중요 피드로 등록된 글은 반의 모든 학생 번호가 표시됨.
각 학생이 피드를 확인하면 자신의 번호가 목록에서 자동으로 사라짐.
이를 통해 누가 해당 피드를 확인했는지 한눈에 파악할 수 있음.`, 
    author: "S:NOW 도움말" 
  },
  {
    title: "글쓰기 / 수정 / 삭제",
    content: `✏️ 버튼으로 글 작성
본인이 쓴 글은 수정·삭제 가능
담임, 반장, 관리자 권한에 따라 작성 권한 다름`,
    author: "S:NOW 도움말"
  },
  {
    title: "새로고침",
    content: `화면을 위로 당기면 새로고침
🔝 버튼을 눌러 맨 위로 이동 후 새 글 확인 가능`,
    author: "S:NOW 도움말"
  },
  {
    title: "기타",
    content: `로그아웃: 상단 ⏻ 버튼
테마 전환: Dark/Light 버튼
피드가 보이지 않거나 화면이 멈출 때: 새로고침`,
    author: "S:NOW 도움말"
  },
  {
    title: "저작권 및 제작 정보",
    content: `S:NOW는 성일정보고등학교 학생용 웹앱입니다.
제작 및 운영: 성일정보고등학교 김형준 선생님
버전: BETA 3.3
최종 업데이트: 2025.10.23.
저작권: © 2025 Sungil Information High School. All rights reserved.
무단 복제 및 배포를 금합니다.
문의: 교육정보부 김형준`,
    author: "S:NOW 도움말"
  }
];

function renderHelpFeed() {
  const helpFeed = document.getElementById("helpFeed");
  helpFeed.innerHTML = "";

  helpData.forEach(item => {
    const div = document.createElement("div");
    div.className = "feed-item";
    div.innerHTML = `
      <div class="feed-title">${item.title}
        <div class="feed-meta">${item.author} · 도움말</div>
      </div>
      <div class="feed-content">${item.content.replace(/\n/g, "<br>")}</div>
    `;
    helpFeed.appendChild(div);
  });
}

// ===== 체크 버튼 클릭 =====
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("check-feed-btn")) {
    const btn = e.target;
    const feedId = btn.dataset.id;
    const tab = btn.dataset.tab;
    const user = JSON.parse(localStorage.getItem("userInfo"));

    // ✅ 학생 번호가 없으면 체크 버튼 기능 차단 (교사 등)
    if (!user?.number) return;

    // ✅ 이미 비활성화된 버튼이라면 바로 return
    if (btn.disabled) return;

    const monthKey = getCurrentMonthKey();
    const classKey = `${user.grade}-${user.class}`;
    const feedRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);

    try {
      // ✅ Firestore 배열에서 해당 학생 번호 제거
      await updateDoc(feedRef, {
        students: arrayRemove(user.number)
      });

      alert("확인했습니다!");

      // ✅ 버튼 비활성화 (한 번만 가능)
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";

      // ✅ 로컬 기록 저장 (새로고침 후에도 유지)
      let checkedFeeds = JSON.parse(localStorage.getItem("checkedFeeds") || "[]");
      if (!checkedFeeds.includes(feedId)) {
        checkedFeeds.push(feedId);
        localStorage.setItem("checkedFeeds", JSON.stringify(checkedFeeds));
      }

      // ✅ 화면(DOM)에서도 해당 번호 제거
      const feedEl = document.querySelector(`.feed-item[data-id="${feedId}"]`);
      if (feedEl) {
        const tagContainer = feedEl.querySelector(".feed-tags");
        if (tagContainer) {
          const tags = tagContainer.querySelectorAll(".tag");
          tags.forEach(tag => {
            if (tag.textContent.trim() === String(user.number)) {
              tag.remove();
            }
          });

          // ✅ 번호가 모두 제거되면 “학생 모두 확인함.” 문구 출력
          const remaining = tagContainer.querySelectorAll(".tag").length;
          if (remaining === 0) {
            tagContainer.innerHTML = `<span class="tag" style="color:#2e7d32;">학생 모두 확인함.</span>`;
          }
        }
      }

    } catch (err) {
      console.error("⚠️ 확인 처리 중 오류:", err);
      alert("처리 중 오류가 발생했습니다.");
    }
  }
});

// 🏷️ 전체탭에서만 태그 클릭 시 필터링
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("tag")) {
    const activeTab = document.querySelector(".tabs button.active")?.dataset.tab;
    if (activeTab !== "all") return; // ✅ 전체탭 아닐 경우 무시

    const selectedTag = e.target.dataset.tag;
    const showAllBtn = document.getElementById("showAllFeedsBtn");
    showAllBtn.style.display = "block";
    // showAllBtn.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });

    // ✅ 전체탭에서만 필터링
    document.querySelectorAll("#allFeed .feed-item").forEach((item) => {
      const tags = item.dataset.tags || "";
      item.style.display = tags.includes(selectedTag) ? "block" : "none";
    });
  }
});

// 🔙 전체보기 버튼 클릭 시 복귀
document.getElementById("showAllFeedsBtn").addEventListener("click", () => {
  const activeTab = document.querySelector(".tabs button.active")?.dataset.tab;
  if (activeTab !== "all") return;

  document.querySelectorAll("#allFeed .feed-item").forEach((item) => {
    item.style.display = "block";
  });
  document.getElementById("showAllFeedsBtn").style.display = "none";
});

// if (location.search.includes("kiosk=true")) {

//     document.body.style.opacity = "0";
//     setTimeout(() => {
//         document.body.style.transition = "opacity 0.4s";
//         document.body.style.opacity = "1";
//     }, 10);

//     setInterval(async () => {
//         const main = document.querySelector("main");
//         if (!main) return; // main 없으면 오류 방지

//         main.style.transition = "opacity 0.3s";
//         main.style.opacity = "0.2";

//         try {
//             lastDocAll = null;
//             await loadFeeds(true);  // 새 데이터 없으면 snap.empty라도 정상
//         } catch (err) {
//             console.error("Refetch 중 오류:", err);
//         } finally {
//             // ❗ 성공 / 실패 / 새 데이터 없음 모두 복구
//             setTimeout(() => {
//                 main.style.opacity = "1";
//             }, 300);
//         }

//     }, 18000); // 3분
// }

// ====== 키오스크 모드: 실시간 피드 변경 감지 ======
import { onSnapshot } from 
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

if (isKioskMode) {

    console.log("🟣 키오스크 모드 실시간 피드 감지 활성화됨");

    const monthKey = getCurrentMonthKey();
    const liveQuery = query(
        collection(db, "feeds", monthKey, "items"),
        orderBy("createdAt", "desc")
    );

    let initialized = false;

    // ===== 1시간마다 전체 페이지 강제 리로드 =====
    setInterval(() => {
        console.log("⏳ 1시간 경과 → 키오스크 페이지 자동 리로드");
        location.reload();
    }, 3600000);  // 1 hour

    onSnapshot(liveQuery, async (snapshot) => {

        // 🟦 최초 1회 스냅샷은 무시 (초기 로딩)
        if (!initialized) {
            initialized = true;
            console.log("📌 초기 로딩 완료");
            return;
        }

        const changes = snapshot.docChanges();
        const main = document.getElementById("mainContent");

        // ===== 공통: mainContent 흐려짐 → 복구 보장 =====
        if (main && main.style.display !== "none") {
            main.style.transition = "opacity 0.25s";
            main.style.opacity = "0.25";

            // 🔥 복구가 누락되는 경우를 대비해 항상 fade-in 강제 복구
            setTimeout(() => {
                main.style.opacity = "1";
            }, 350);
        }

        // ===== 변경된 문서 개수만큼 처리 =====
        for (const change of changes) {

            const docId = change.doc.id;
            const data = change.doc.data();

            // ===============================
            // 🔵 1) 새 글 추가 (added)
            // ===============================
            if (change.type === "added") {
                console.log("🟢 실시간 추가 감지:", docId);

                lastDocAll = null;
                await loadFeeds(true);
                continue;
            }

            // ===============================
            // 🟡 2) 글 수정 (modified)
            // ===============================
            if (change.type === "modified") {
                console.log("🟡 실시간 수정 감지:", docId);

                const feedEl = document.querySelector(`.feed-item[data-id="${docId}"]`);

                if (feedEl) {
                    feedEl.querySelector(".feed-title").textContent = data.title;
                    feedEl.querySelector(".feed-content").innerHTML =
                        makeLinksClickable(data.content);
                } else {
                    lastDocAll = null;
                    await loadFeeds(true);
                }
                continue;
            }

            // ===============================
            // 🔴 3) 글 삭제 (removed)
            // ===============================
            if (change.type === "removed") {
                console.log("🔴 실시간 삭제 감지:", docId);

                const feedEl = document.querySelector(`.feed-item[data-id="${docId}"]`);

                if (feedEl) {
                    feedEl.remove();
                } else {
                    lastDocAll = null;
                    await loadFeeds(true);
                }
                continue;
            }
        }
    });
}
