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
const helpFeed = document.getElementById("helpFeed");
const header = document.getElementById("appHeader");
const backToTop = document.getElementById("backToTop");
const themeToggle = document.getElementById("themeToggle");
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

// ===== 권한 =====
function canViewTab(user, tab) {
  const privilege = user.privilege ?? "";
  if (tab === "all") return true;
  if (tab === "class") {
    if (user.role === "교사" && privilege === "담임") return true;
    if (user.role === "학생") return true;
  }
  return false;
}
function canWriteFeed(user, tab) {
  const privilege = user.privilege ?? "";
  if (privilege === "총관리자") return true;
  if (tab === "all" && privilege === "관리자") return true;
  if (tab === "class" && ["담임", "반장", "부반장"].includes(privilege)) return true;
  return false;
}
function canDeleteFeed(user, tab) {
  const privilege = user.privilege ?? "";
  if (privilege === "총관리자") return true;
  if (privilege === "관리자" && tab === "all") return true;
  if (["담임", "반장", "부반장"].includes(privilege) && tab === "class") return true;
  return false;
}

// ===== 피드 초기화 =====
function clearFeed() { allFeed.innerHTML = ""; }
function clearClassFeed() { classFeed.innerHTML = ""; }

// ===== 피드 렌더링 =====
function renderFeedItem(id, item, tab = "all") {
  const feedEl = (tab === "all") ? document.getElementById("allFeed") : document.getElementById("classFeed");
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
let isLoadingAll = false;
let isLoadingClass = false;

async function loadFeeds(initial = false) {
  if (isLoadingAll) return;
  isLoadingAll = true;
  const monthKey = getCurrentMonthKey();
  let q;
  if (initial || !lastDocAll) {
    q = query(
      collection(db, "feeds", monthKey, "items"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      collection(db, "feeds", monthKey, "items"),
      orderBy("createdAt", "desc"),
      startAfter(lastDocAll),
      limit(PAGE_SIZE)
    );
  }

  const snap = await getDocs(q);
  if (snap.empty && initial) {
    clearFeed();
    allFeed.innerHTML = `<div class="no-feed-message">📭 아직 작성된 피드가 없습니다.</div>`;
    isLoadingAll = false;
    return;
  }

  if (initial) clearFeed();
  snap.forEach(doc => {
    if (!document.querySelector(`[data-id="${doc.id}"]`)) {
      renderFeedItem(doc.id, doc.data(), "all");
    }
  });
  lastDocAll = snap.docs[snap.docs.length - 1] || null;
  isLoadingAll = false;
}

async function loadClassFeeds(user, initial = true) {
  if (isLoadingClass) return;
  isLoadingClass = true;
  const monthKey = getCurrentMonthKey();
  const classKey = `${user.grade}-${user.class}`;
  let q;
  if (initial || !lastDocClass) {
    q = query(
      collection(db, "classFeeds", classKey, `feeds_${monthKey}`),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      collection(db, "classFeeds", classKey, `feeds_${monthKey}`),
      orderBy("createdAt", "desc"),
      startAfter(lastDocClass),
      limit(PAGE_SIZE)
    );
  }

  const snap = await getDocs(q);
  if (snap.empty && initial) {
    clearClassFeed();
    classFeed.innerHTML = `<div class="no-feed-message">📭 아직 작성된 피드가 없습니다.</div>`;
    isLoadingClass = false;
    return;
  }

  if (initial) clearClassFeed();
  snap.forEach(doc => {
    if (!document.querySelector(`[data-id="${doc.id}"]`)) {
      renderFeedItem(doc.id, doc.data(), "class");
    }
  });
  lastDocClass = snap.docs[snap.docs.length - 1] || null;
  isLoadingClass = false;
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
  }
});

// ===== 피드 저장 =====
async function saveFeed(title, content, user, tab) {
  const monthKey = getCurrentMonthKey();
  let colRef;
  if (tab === "all") {
    colRef = collection(db, "feeds", monthKey, "items");
  } else {
    const classKey = `${user.grade}-${user.class}`;
    colRef = collection(db, "classFeeds", classKey, `feeds_${monthKey}`);
  }
  await addDoc(colRef, {
    title,
    content,
    createdAt: serverTimestamp(),
    author: user.displayName,
    authorEmail: user.email
  });
}

// ===== 피드 등록/수정 =====
submitFeed.addEventListener("click", async () => {
  const mode = feedModal.dataset.mode;
  const feedId = feedModal.dataset.id;
  const title = document.getElementById("feedTitle").value.trim();
  const content = document.getElementById("feedContent").value.trim();
  const user = JSON.parse(localStorage.getItem("userInfo"));
  const currentTab = document.querySelector(".tabs button.active").dataset.tab;

  if (!title || !content) {
    alert("제목과 내용을 모두 입력해주세요.");
    return;
  }

  try {
    if (mode === "create") {
      await saveFeed(title, content, user, currentTab);
      alert("피드가 등록되었습니다!");

      if (currentTab === "all") {
        clearFeed();
        lastDocAll = null;
        await loadFeeds(true);
      } else if (currentTab === "class") {
        clearClassFeed();
        lastDocClass = null;
        await loadClassFeeds(user, true);
      }
    } else if (mode === "edit") {
      const monthKey = getCurrentMonthKey();
      let docRef;
      if (currentTab === "all") {
        docRef = doc(db, "feeds", monthKey, "items", feedId);
      } else {
        const classKey = `${user.grade}-${user.class}`;
        docRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);
      }
      await updateDoc(docRef, { title, content, updatedAt: serverTimestamp() });

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

    feedModal.style.display = "none";
    document.getElementById("feedTitle").value = "";
    document.getElementById("feedContent").value = "";
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
      } else {
        const classKey = `${user.grade}-${user.class}`;
        docRef = doc(db, "classFeeds", classKey, `feeds_${monthKey}`, feedId);
      }
      await deleteDoc(docRef);
      e.target.closest(".feed-item").remove();
      alert("피드가 삭제되었습니다.");
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

  tabButtons.forEach(t => t.classList.remove("active"));
  document.querySelector('[data-tab="all"]').classList.add("active");

  lastDoc = null;
  loadFeeds(true);

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
  writeBtn.style.display = canWriteFeed(user, currentTab) ? "flex" : "none";
}

// ===== 로그인 =====
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email;
    if (!email.endsWith("@sungil-i.kr")) {
      alert("학교 계정(@sungil-i.kr)으로만 로그인 가능합니다.");
      await signOut(auth);
      return;
    }

    welcomeText.style.display = "none";
    loginBtn.style.display = "none";
    introLoading.style.display = "flex";

    const response = await fetch(`https://script.google.com/macros/s/AKfycbxmqshTE7wvCRpCV-u7d6vF7mAqmi3bYoy6uOt_HaAfKca3gf3U61nosYvMH-zBTqga/exec?email=${email}`);
    const data = await response.json();
    if (!data.success) {
      alert("시트에서 사용자를 찾을 수 없습니다.");
      await signOut(auth);
      return;
    }
    const userInfo = data.user;
    const displayName = userInfo.role === "교사"
      ? `${userInfo.name} 선생님`
      : `${userInfo.grade}학년 ${userInfo.class}반 ${userInfo.name}`;
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userInfo", JSON.stringify({
      ...userInfo,
      displayName,
      role: userInfo.role || "",
      privilege: userInfo.privilege || "",
      grade: userInfo.grade || "",
      class: userInfo.class || ""
    }));
    showMainScreen(userInfo, displayName);
    updateUI(userInfo);

    // await requestAndSaveFCMToken(user.email);
  } catch (error) {
    console.error(error);
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

    mainContent.classList.remove("all-tab", "class-tab", "help-tab");

    if (tab.dataset.tab === "all") {
      allFeed.style.display = "block";
      classFeed.style.display = "none";
      helpFeed.style.display = "none";
      mainContent.classList.add("all-tab");
      mainContent.classList.add("blue-border");
      mainContent.classList.remove("red-border");
      mainContent.classList.remove("purple-border");
      header.classList.add("blue-header");
      header.classList.remove("pink-header");
      header.classList.remove("purple-header");
      clearFeed();
      lastDoc = null;
      loadFeeds(true);
    } else if (tab.dataset.tab === "class") {
      allFeed.style.display = "none";
      helpFeed.style.display = "none";
      classFeed.style.display = "block";
      mainContent.classList.add("class-tab");
      mainContent.classList.add("red-border");
      mainContent.classList.remove("blue-border");
      mainContent.classList.remove("purple-border");
      header.classList.add("pink-header");
      header.classList.remove("blue-header");
      header.classList.remove("purple-header");
      clearClassFeed();
      lastDoc = null;
      const savedUser = JSON.parse(localStorage.getItem("userInfo"));
      if (savedUser) loadClassFeeds(savedUser, true);
    } else if (tab.dataset.tab === "help") {
      allFeed.style.display = "none";
      classFeed.style.display = "none";
      helpFeed.style.display = "block";
      mainContent.classList.add("help-tab");
      mainContent.classList.add("purple-border");
      mainContent.classList.remove("blue-border");
      header.classList.add("purple-header");
      header.classList.remove("blue-header");
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
문제 발생 시 교육정보부 김형준 선생님에게 문의`,
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
