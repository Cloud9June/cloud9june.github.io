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
  query, orderBy, limit, startAfter, getDocs,
  doc, deleteDoc, updateDoc
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

// ===== 권한 =====
function canViewTab(user, tab) {
  const privileges = user.privilege ?? [];

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
  const privileges = user.privilege ?? [];

  if (privileges.includes("총관리자")) return true;
  if (tab === "all" && privileges.includes("관리자")) return true;
  if (tab === "external" && privileges.includes("관리자")) return true;
  if (tab === "class" && (privileges.includes("담임") || privileges.includes("반장") || privileges.includes("부반장")))
    return true;

  return false;
}
function canDeleteFeed(user, tab) {
  const privileges = user.privilege ?? [];

  if (privileges.includes("총관리자")) return true;
  if (tab === "all" && privileges.includes("관리자")) return true;
  if (tab === "external" && privileges.includes("관리자")) return true;
  if (tab === "class" && (privileges.includes("담임") || privileges.includes("반장") || privileges.includes("부반장")))
    return true;

  return false;
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

  const user = JSON.parse(localStorage.getItem("userInfo"));

  let actionBtns = "";
  if (user && canDeleteFeed(user, tab)) {
    actionBtns += `<button class="delete-feed-btn" data-id="${id}" data-tab="${tab}">×</button>`;
  }
  if (user && canWriteFeed(user, tab)) {
    actionBtns += `<button 
        class="edit-feed-btn" 
        data-id="${id}" 
        data-tab="${tab}"
        data-title="${item.title}" 
        data-content="${item.content}">✏️</button>`;
  }

  div.innerHTML = `
    ${actionBtns}
    <div class="feed-title">
      ${item.title}
      <div class="feed-meta">${createdAt} · ${item.author}</div>
    </div>
    <div class="feed-content">${item.content}</div>
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
    const monthKeys = getMonthKeys(2); // 이번 달 + 지난달

    let snaps = [];

    if (initial) {
      // ✅ 초기 로딩: 이번 달 + 지난달 불러오기
      const queries = monthKeys.map(key =>
        query(
          collection(db, "feeds", key, "items"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        )
      );
      snaps = await Promise.all(queries.map(q => getDocs(q)));
    } else {
      // ✅ 무한 스크롤: 이번 달만 추가 로딩
      const q = query(
        collection(db, "feeds", monthKeys[0], "items"),
        orderBy("createdAt", "desc"),
        startAfter(lastDocAll),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      snaps = [snap]; // 배열 형태로 맞춰줌
    }

    if (initial) clearFeed();

    snaps.forEach((snap, idx) => {
      console.log(`로드된 문서 개수 (${monthKeys[idx] || "이번달"}):`, snap.docs.length);
      snap.forEach(doc => {
        // ✅ 중복 방지: 이미 렌더링된 ID는 스킵
        if (!document.querySelector(`[data-id="${doc.id}"]`)) {
          renderFeedItem(doc.id, doc.data(), "all");
        }
      });
    });

    // ✅ 페이지네이션 포인터는 이번 달만 갱신
    const currentSnap = snaps[0];
    if (!currentSnap.empty) {
      lastDocAll = currentSnap.docs[currentSnap.docs.length - 1];
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
      snaps = await Promise.all(queries.map(q => getDocs(q)));
    } else {
      // ✅ 무한 스크롤: 이번 달만 추가 로딩
      const q = query(
        collection(db, "classFeeds", classKey, `feeds_${monthKeys[0]}`),
        orderBy("createdAt", "desc"),
        startAfter(lastDocClass),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      snaps = [snap];
    }

    if (initial) clearClassFeed();

    snaps.forEach((snap, idx) => {
      console.log(`우리반 로드 (${monthKeys[idx] || "이번달"}):`, snap.docs.length);
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
  if (isImportant && ["담임", "반장", "부반장"].includes(user.privilege)) {
    try {
      const response = await fetch(
        `https://script.google.com/macros/s/AKfycbwp-WP0s_G9ibtVBmXSZzTLqMIEMoQej7YBLjk7VX-J98_RvnwjnqGVYroEP_fHN8kXWA/exec?grade=${user.grade}&class=${user.class}`
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

  try {
    if (mode === "create") {
      // ✅ 중요 피드일 경우 학생 번호 목록 가져오기
      let studentNumbers = [];
      if (
        isImportant &&
        Array.isArray(user.privilege) &&
        user.privilege.some(p => ["담임", "반장", "부반장"].includes(p))
      ) {
        try {
          const response = await fetch(
            `https://script.google.com/macros/s/AKfycbwp-WP0s_G9ibtVBmXSZzTLqMIEMoQej7YBLjk7VX-J98_RvnwjnqGVYroEP_fHN8kXWA/exec?grade=${user.grade}&class=${user.class}`
          );
          const data = await response.json();
          if (data.success && Array.isArray(data.students)) {
            studentNumbers = data.students;
          }
        } catch (err) {
          console.error("학생 번호 불러오기 오류:", err);
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
        createdAt: serverTimestamp(),
        author: user.displayName,
        authorEmail: user.email,
        important: isImportant,
        students: studentNumbers
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

    } else if (mode === "edit") {
      // ✅ 수정 모드
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

      await updateDoc(docRef, {
        title,
        content,
        updatedAt: serverTimestamp()
      });

      // ✅ DOM 갱신
      const feedEl = document.querySelector(`.feed-item[data-id="${feedId}"]`);
      if (feedEl) {
        feedEl.querySelector(".feed-title").innerHTML = `
          ${title}
          <div class="feed-meta">${formatDate(new Date())} · ${user.displayName}</div>
        `;
        feedEl.querySelector(".feed-content").textContent = content;
      }

      alert("피드가 수정되었습니다!");
    }

    // ✅ 모달 닫기 및 초기화
    feedModal.style.display = "none";
    document.getElementById("feedTitle").value = "";
    document.getElementById("feedContent").value = "";
    document.getElementById("importantCheck").checked = false;
  } catch (err) {
    console.error("피드 저장 오류:", err);
    alert("저장에 실패했습니다.");
  }
});


// ===== 피드 수정 모드 =====
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-feed-btn")) {
    const feedId = e.target.dataset.id;
    const feedTitle = e.target.dataset.title || "";
    const feedContent = e.target.dataset.content || "";
    const tab = e.target.dataset.tab;

    document.querySelector("#feedModal h2").textContent = "피드 수정";
    document.getElementById("submitFeed").textContent = "수정 완료";

    document.getElementById("feedTitle").value = feedTitle;
    document.getElementById("feedContent").value = feedContent;

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
  document.getElementById("userInfo").textContent = displayName;

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
      privilege: [],
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

    // ✅ 로그인 시에는 항상 전체 탭부터 시작
    localStorage.setItem("activeTab", "all");

    welcomeText.style.display = "none";
    loginBtn.style.display = "none";
    guestLink.style.display = "none";
    introLoading.style.display = "flex";

    // ✅ Apps Script 호출 (URL은 새로 발급받은 Web App URL로 유지)
    const response = await fetch(
      `https://script.google.com/macros/s/AKfycbxfCkVJWMtxJ7H3SS_5FoPOpAGK1N1i_IX2BH4QizJA6pTVoKNsyEd66q37RAG8N6jqUw/exec?email=${email}`
    );
    const data = await response.json();

    if (!data.success) {
      alert("시트에서 사용자를 찾을 수 없습니다.");
      await signOut(auth);
      return;
    }

    const userInfo = data.user;

    // ✅ 이름 표시
    const displayName =
      userInfo.role === "교사"
        ? `${userInfo.name} 선생님`
        : `${userInfo.grade}학년 ${userInfo.class}반 ${userInfo.name}`;

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
        privilege: privilegeArray,
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
    await showMainScreen(savedUser, savedUser.displayName);
    updateUI(savedUser);
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

const helpData = [{
    title: "설치 방법 (홈 화면 추가)",
    content: `안드로이드: 크롬 → 메뉴(⋮) → 홈 화면에 추가
iOS: Safari → 공유(⬆️) → 홈 화면에 추가
👉 운영체제/브라우저 버전에 따라 위치가 다를 수 있습니다.
✅ 무엇이 되었든 '홈 화면에 추가'만 찾으면 앱처럼 사용할 수 있습니다.`,
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
버전: BETA 1.0
최종 업데이트: 2025.10.15.
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
