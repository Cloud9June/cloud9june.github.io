// ===== Service Worker 등록 =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => console.log("Service Worker registered:", reg))
    .catch(err => console.error("Service Worker failed:", err));
}

// ===== Pull-to-Refresh =====
let startY = 0;
let distance = 0;
const threshold = 150;
const deadzone = 30;
const indicator = document.getElementById("ptrIndicator");

document.addEventListener("touchstart", (e) => {
  if (window.scrollY <= 0) {
    startY = e.touches[0].pageY;
  }
});

document.addEventListener("touchmove", (e) => {
  if (window.scrollY <= 0) {
    distance = e.touches[0].pageY - startY;
    if (distance > deadzone) {
      indicator.style.top = Math.min((distance - deadzone) - 40, 40) + "px";
      indicator.innerText = distance > threshold ? "🔄 놓으면 새로고침" : "⬇️ 당겨서 새로고침";
    }
  }
});

document.addEventListener("touchend", () => {
  if (distance > threshold) {
    indicator.innerText = "⏳ 새로고침 중...";
    setTimeout(() => {
      window.location.href = window.location.href;
    }, 300);
  } else {
    indicator.style.top = "-50px";
  }
  startY = 0;
  distance = 0;
});

// ===== 제목 애니메이션 (S:NOW) =====
const extraEl = document.getElementById("extra");
const extraText = "UNGIL ";
let isFull = true;
let animationTimer = null; // 중복 방지용

function typeExtra(callback) {
  let i = 0;
  extraEl.textContent = "";
  const typing = setInterval(() => {
    extraEl.textContent = extraText.slice(0, i++);
    if (i > extraText.length) {
      clearInterval(typing);
      if (callback) setTimeout(callback, 1000);
    }
  }, 150);
}

function deleteExtra(callback) {
  let text = extraEl.textContent;
  let i = text.length;
  const deleting = setInterval(() => {
    extraEl.textContent = text.slice(0, i--);
    if (i < 0) {
      clearInterval(deleting);
      if (callback) setTimeout(callback, 500);
    }
  }, 100);
}

function toggleTitle() {
  if (!isFull) {
    typeExtra();
    isFull = true;
  } else {
    deleteExtra();
    isFull = false;
  }
}
// 안전하게 interval 실행
function startTitleAnimation() {
  if (animationTimer) clearInterval(animationTimer);
  animationTimer = setInterval(toggleTitle, 6000);
}

// 처음 시작
startTitleAnimation();

// 탭 전환 감지
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // 돌아올 때 애니메이션 상태 리셋
    startTitleAnimation();
  }
});

// ===== 스크롤 이벤트 (헤더/탑버튼/쓰기버튼) =====
const header = document.getElementById("appHeader");
const backToTop = document.getElementById("backToTop");
const writeFeedBtn = document.getElementById("writeFeedBtn");

window.addEventListener("scroll", () => {
  if (window.scrollY > 10) header.classList.add("scrolled");
  else header.classList.remove("scrolled");

  if (window.scrollY > 200) {
    backToTop.classList.add("show");
    writeFeedBtn.classList.add("shift-up");
  } else {
    backToTop.classList.remove("show");
    writeFeedBtn.classList.remove("shift-up");
  }
});

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== 테마 토글 =====
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const root = document.documentElement;
  const currentTheme = root.getAttribute("data-theme");
  if (currentTheme === "dark") {
    root.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
    themeToggle.textContent = "Dark";
  } else {
    root.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
    themeToggle.textContent = "Light";
  }
});
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "dark" ? "Light" : "Dark";
});
