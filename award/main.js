/* =========================================================
   성일정보고 성과 & 취업 현황 - 메인 스크립트 (안드/아이폰 모두 맞춤)
   - 기능/디자인 변경 없음 / 뷰포트·행수 자동보정만 강화
   - 튜토리얼 오버레이 추가
   - 터치기기만 튜토리얼 생성
   ========================================================= */

// 튜토리얼 관련
const tutorialOverlay = document.getElementById('tutorial-overlay');
const closeBtn = document.querySelector('.close-btn');
const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

let isFallback = false;
let fallbackTimer = null;

// 사용자가 튜토리얼을 본 적이 없다면 오버레이 표시
if (!hasSeenTutorial && isTouchDevice) {
  tutorialOverlay.style.display = 'flex';
}

// 닫기 버튼 또는 오버레이 클릭 시
closeBtn.addEventListener('click', () => {
  tutorialOverlay.style.display = 'none';
  localStorage.setItem('hasSeenTutorial', 'false'); 
});

tutorialOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'tutorial-overlay') {
    tutorialOverlay.style.display = 'none';
    localStorage.setItem('hasSeenTutorial', 'false');
  }
});

// 최상단 유틸 근처에 추가
function shouldOverflow(cards, slack = 2) {
  // 1) 고전적 오버플로우
  if ((cards.scrollHeight - cards.clientHeight) > slack) return true;

  // 2) "시각적" 겹침 감지: 마지막 실카드 vs 도트/컨테이너 하단
  const realCards = cards.querySelectorAll('.card:not(.placeholder)');
  if (!realCards.length) return false;

  const lastRect   = realCards[realCards.length - 1].getBoundingClientRect();
  const cardsRect  = cards.getBoundingClientRect();
  const dotsEl     = document.getElementById('dots');
  const dotsRect   = dotsEl ? dotsEl.getBoundingClientRect() : null;

  // 도트 위 살짝 여백(6px)까지 안전영역으로 본다
  const overlapWithDots      = dotsRect ? (lastRect.bottom > (dotsRect.top - 6)) : false;
  // 컨테이너 자체 하단과의 겹침(2px 여유)
  const clippedByContainer   = lastRect.bottom > (cardsRect.bottom - 2);

  return overlapWithDots || clippedByContainer;
}

// 안전한 자동 전환(2프레임 연속 오버플로우 확인)
function checkAndMaybeFallback(tabKey) {
  const page  = document.querySelector('.page.active');
  const cards = page?.querySelector('.cards');
  if (!cards) return;

  requestAnimationFrame(() => {
    const first = isClippingAtRow(cards, 3, 4); // 3행이 잘리는지
    requestAnimationFrame(() => {
      const second = isClippingAtRow(cards, 3, 4); // 2프레임 연속 확인
      if (second) {
        showFallbackAndRedirect(tabKey);
      }
    });
  });
}

// N번째(기본 3번째) "실카드"가 안전 하단선을 넘는지 감지
function isClippingAtRow(cards, rowIndex = 3, slackPx = 4) {
  const realCards = cards.querySelectorAll('.card:not(.placeholder)');
  if (realCards.length < rowIndex) return false;

  const target = realCards[rowIndex - 1]; // 3행 = index 2
  const tRect   = target.getBoundingClientRect();
  const cardsRect = cards.getBoundingClientRect();

  const dotsEl   = document.getElementById('dots');
  const dotsRect = dotsEl ? dotsEl.getBoundingClientRect() : null;

  // 도트가 있으면 그 윗부분, 없으면 카드컨테이너 하단을 안전 하단선으로 사용
  const safeBottom = Math.min(
    cardsRect.bottom - 2,
    dotsRect ? (dotsRect.top - 6) : Infinity
  );

  return (tRect.bottom - safeBottom) > slackPx; // 4px 초과 시 '진짜 잘림'
}

// 렌더 완료 직후 한 번 호출
function setupAutoFallbackObservers(tabKey) {
  // 기존 옵저버 있으면 해제
  if (window.__fallbackObs) { window.__fallbackObs.disconnect(); window.__fallbackObs = null; }

  const page  = document.querySelector('.page.active');
  const cards = page?.querySelector('.cards');
  if (!cards) return;

  // 카드 영역 크기 변동 감시
  const ro = new ResizeObserver(() => {
    if (PAGE_SIZE <= 3) checkAndMaybeFallback(tabKey);
  });
  ro.observe(cards);
  window.__fallbackObs = ro;

  // iOS 주소창/안드 내비바 변화 대응
  if (window.visualViewport) {
    const vvHandler = () => { if (PAGE_SIZE <= 3) checkAndMaybeFallback(tabKey); };
    window.visualViewport.addEventListener('resize', vvHandler);
    window.visualViewport.addEventListener('scroll', vvHandler);
    // 한번만 등록되도록 저장
    if (!window.__vvBound) window.__vvBound = true;
  }

  // 회전, 페이지 표시(백/포그라운드) 시 재검사
  const late = () => { if (PAGE_SIZE <= 3) checkAndMaybeFallback(tabKey); };
  window.addEventListener('orientationchange', late, { passive: true });
  window.addEventListener('pageshow', late, { passive: true });

  // 폰트 적용 이후에도 한 번 더 (구형 iOS는 타임아웃으로 보강)
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => setTimeout(late, 0));
  } else {
    setTimeout(late, 300);
  }

  // 초기 1회 확인
  late();
}



function showFallbackAndRedirect(tabKey, delayMs = 2200) {
  if (isFallback) return;
  isFallback = true;

  stopAuto(); // 자동 전환 정지

  const ov = document.getElementById('fallbackOverlay');
  if (ov) {
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');
  }

  // 지연 후 '한 번에 보기'로 이동
  fallbackTimer = setTimeout(() => {
    location.href = `overview.html?tab=${encodeURIComponent(tabKey)}`;
  }, delayMs);
}

/* ========== 0) iOS 판별 + --vh 설정 ========== */
function isIOSLike() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}
if (isIOSLike()) document.documentElement.classList.add('is-ios');

/* ========== 0) 모든 기기에서 뷰포트 높이 보정 ========== */
function setVH() {
  // window.innerHeight와 visualViewport.height 중 더 작은 값을 선택하여
  // 주소창이나 툴바가 가리는 영역을 고려한 실제 가시 높이를 계산합니다.
  const height = Math.min(window.innerHeight, (window.visualViewport?.height ?? window.innerHeight));
  
  // --vh 변수 설정
  document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
}

// 초기 로드 시 실행
setVH();

// 리사이즈, 스크롤 등 뷰포트 관련 이벤트에 리스너 추가
window.addEventListener('resize', setVH, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setVH, { passive: true });
  window.visualViewport.addEventListener('scroll', setVH, { passive: true });
}

/* ========== 1) 데이터 유틸 ========== */
const maskName = (name) => {
  if (!name) return "";
  return String(name).split(/[,\n]+/g).map(n=>{
    const arr=[...n.trim()];
    if(arr.length===2) return arr[0]+"○";
    if(arr.length>=3) return arr[0]+"○"+arr.slice(2).join("");
    return n.trim();
  }).join(", ");
};

function countPeople(name){
  if(!name) return 0;
  const m = String(name).match(/총\s*([0-9]+)\s*명/);
  if(m) return parseInt(m[1],10);
  return String(name).split(/[,\n]+/g).map(s=>s.trim()).filter(Boolean).length;
}

const prizeClass = (p) => {
  if (!p) return "";
  if (p.includes("대상")) return "grand";
  if (p.includes("금"))   return "gold";
  if (p.includes("은"))   return "silver";
  if (p.includes("동"))   return "bronze";
  return "";
};
const typeClass  = (t) => {
  if (!t) return "";
  if (t.includes("공기업")) return "public";
  if (t.includes("공단"))   return "agency";
  if (t.includes("군"))     return "military";
  return "corp";
};
const statusClass = (s) => s?.includes("우량") ? "excellent" : "apprentice";

function admissionsCountItem(it){
  if (typeof it.count === "number") return it.count;
  if (it.count && /^\d+$/.test(it.count)) return parseInt(it.count,10);
  if (it.name) return 1;
  return 1;
}
function groupDisplay(g){
  if (g==="4년제대학") return "4년제대학";
  if (g==="전문대")    return "전문대학";
  if (g==="선취업후진학") return "선취업후진학";
  return g||"";
}

/* ========== 2) 전역 상태 ========== */
const root = document.body;
const btnFx = document.getElementById('fxToggle');
const viewport = document.getElementById("viewport");
const dots = document.getElementById("dots");
const pageInfo = document.getElementById("pageInfo");
const countTotal = document.getElementById("countTotal");
const extraInfo = document.getElementById("extraInfo");

const AUTO_INTERVAL_MS = 6000;
let PAGE_SIZE = 7;
let currentTab = "awards";
let pageIndex = 0;
let autoTimer = null;
let pages = [];
let isPaused = false;

/* ========== 3) 효과 토글 ========== */
root.classList.add('effects-on');
updateFxLabel();
btnFx.addEventListener('click', ()=>{
  root.classList.toggle('effects-on');
  updateFxLabel();
});
function updateFxLabel(){
  const on = root.classList.contains('effects-on');
  btnFx.textContent = on ? '✨ 효과 ON' : '✨ 효과 OFF';
}

/* ========== 4) 정렬/탭/페이지 유틸 ========== */
const TAB_ORDER = ["awards", "jobs", "doje", "nco", "admissions"];

function getNcoSortKey(cohort){
  if(!cohort) return 999;
  let num = parseInt(cohort.replace(/[^0-9]/g,""), 10);
  if(cohort.includes("동아리")) return num - 9;
  return num;
}

function nextAcross(){
  if (pages.length && pageIndex < pages.length - 1) {
    goToPage(pageIndex + 1);
  } else {
    const i = TAB_ORDER.indexOf(currentTab);
    const nextTab = TAB_ORDER[(i + 1) % TAB_ORDER.length];
    setActiveTab(nextTab);
  }
}

const chunk = (arr,size)=>arr.reduce((acc,_,i)=>(i%size?acc:acc.concat([arr.slice(i,i+size)])),[]);

/* ========== 5) “몇 행 보여줄지” 1차 추정치 ========== */
function computePageSizeByHeight(availHeightPx){
  const perRowGuess = (window.innerWidth <= 480) ? 85 : 110; // 대략치
  const raw = Math.floor(availHeightPx / perRowGuess);
  const clamped = Math.max(3, Math.min(12, raw));
  const candidates=[12,10,9,8,7,6,5,4,3];
  let best=clamped, diff=Infinity;
  for(const n of candidates){
    const d=Math.abs(n-clamped);
    if(d<diff){ diff=d; best=n; }
  }
  return best;
}

/* 실제 1행 높이 측정(카드+gap) */
function measureRowHeight(){
  const page = document.querySelector('.page.active');
  if(!page) return null;
  const cards = page.querySelector('.cards');
  const first = cards?.querySelector('.card:not(.placeholder)');
  if(!cards || !first) return null;
  const cs = getComputedStyle(cards);
  const gap = parseFloat(cs.rowGap || cs.gap || 0);
  const h = first.getBoundingClientRect().height;
  return h + gap + 1;
}

/* 실제 영역 기준으로 행수 자동 보정(넘치면 줄이고, 남으면 1행까지 늘림) */
function autoFitRows() {
  const page = document.querySelector('.page.active');
  const cards = page?.querySelector('.cards');
  if (!cards) return;

  // 1) 넘치면 한 행씩 줄이기
  while (cards.scrollHeight > cards.clientHeight && PAGE_SIZE > 3) {
    PAGE_SIZE--;
    // 변경된 PAGE_SIZE로 다시 렌더링 (플레이스홀더 개수만 변경)
    cards.style.setProperty("--rows", PAGE_SIZE);
    
    // 플레이스홀더를 다시 계산하여 적용
    const totalCards = page.querySelectorAll('.card:not(.placeholder)').length;
    let placeholderCount = PAGE_SIZE - (totalCards % PAGE_SIZE);
    if(placeholderCount === PAGE_SIZE) placeholderCount = 0;
    
    // 기존 플레이스홀더 삭제
    page.querySelectorAll('.placeholder').forEach(p => p.remove());

    // 새로운 플레이스홀더 생성
    for(let i=0; i<placeholderCount; i++) {
        const p = document.createElement("div");
        p.className = "card placeholder";
        cards.appendChild(p);
    }
  }

  // 2) 남으면 한 행씩 늘려보기
  const perRow = measureRowHeight();
  if (perRow && PAGE_SIZE < 12) {
      const spare = cards.clientHeight - cards.scrollHeight;
      // 여유 공간이 1.5행 높이 이상이면 한 행 추가
      if (spare > perRow * 1.5) {
          PAGE_SIZE++;
          render(false); // 재귀 호출
      }
  }

  const lastPage  = document.querySelector('.page.active');
  const lastCards = lastPage?.querySelector('.cards');
  if (lastCards && isClippingAtRow(lastCards, 3, 4)) {
    // 3행이 정상적으로 못 들어가면 → 오버레이 & 이동
    showFallbackAndRedirect(currentTab);
    return;
  }
}

/* ========== 6) 메인 렌더 ========== */
function render(autoFit = true){
  let data =
    currentTab==="awards" ? awards :
    currentTab==="jobs"   ? jobs   :
    currentTab==="doje"   ? doje   :
    currentTab==="nco"    ? nco    :
                            admissions;

  if(currentTab==="nco"){
    data = [...data].sort((a,b)=>getNcoSortKey(b.cohort) - getNcoSortKey(a.cohort));
  }

  const totalCount =
    currentTab==="awards" ? awards.reduce((s,it)=>s+countPeople(it.name),0) :
    currentTab==="doje"   ? doje.reduce((s,it)=>s+countPeople(it.name),0)   :
    currentTab==="nco"    ? data.length :
    currentTab==="admissions" ? admissions.reduce((s,it)=>s + admissionsCountItem(it), 0) :
                                jobs.length;
  countTotal.textContent=totalCount;

  // 1차 추정 PAGE_SIZE
  const rect = viewport.getBoundingClientRect();
  PAGE_SIZE = computePageSizeByHeight(rect.height);

  // ★ 이론상 최소 3행도 불가(혹은 극단적인 환경) → 바로 오버레이 & 이동
  if (PAGE_SIZE < 3) {
    showFallbackAndRedirect(currentTab);
    return;
  }

  // DOM 구성
  viewport.innerHTML = "";
  dots.innerHTML = "";
  pages = [];

  const groups = chunk(data, PAGE_SIZE);
  groups.forEach((group, idx)=>{
    const filled = group.slice();
    while(filled.length < PAGE_SIZE) filled.push({__placeholder:true});

    const page=document.createElement("div");
    page.className="page"+(idx===0?" active":"");

    const cards=document.createElement("div");
    cards.className="cards";
    cards.style.setProperty("--rows", PAGE_SIZE);

    filled.forEach((item)=>{
      const card=document.createElement("div");
      card.className="card";
      if(item.__placeholder) card.classList.add("placeholder");

      const avatar=document.createElement("div"); avatar.className="avatar";
      const meta=document.createElement("div"); meta.className="meta";
      const line1=document.createElement("div"); line1.className="line1";
      const line2=document.createElement("div"); line2.className="line2";
      const badge=document.createElement("div"); badge.className="badge";

      if(currentTab==="awards"){
        avatar.textContent=item.icon||"🏆";
        line1.innerHTML=item.comp||"";

        if(item.name){
          const names = String(item.name).split(/[,\n]+/g).map(s=>maskName(s.trim())).filter(Boolean);
          if (window.innerWidth <= 412 && names.length > 1) {
            line2.innerHTML = `${names[0]} 외 ${names.length - 1}명 · ${item.year||""}`;
          } else {
            line2.innerHTML = `${names.join(", ")} · ${item.year||""}`;
          }
        } else {
          line2.innerHTML="";
        }

        badge.textContent=item.prize||"";
        badge.className+=" "+(item.prize?prizeClass(item.prize):"");
        if (item.isPremier) card.classList.add("elite-award"); // 전국/국제 등 강조

      }else if(currentTab==="jobs"){
        avatar.textContent=item.emoji||"🏢";
        line1.innerHTML=item.company||"";
        line2.innerHTML = (item.dept || "") + " " + (item.name ? maskName(item.name) : "");
        badge.textContent=item.type||"";
        badge.className+=" "+(item.type?typeClass(item.type):"");

      }else if(currentTab==="doje"){
        avatar.textContent="🧑🏻‍💻";
        line1.innerHTML=item.company||"";
        line2.innerHTML=(item.dept || "") + " " +(item.name?maskName(item.name):"")+" · "+(item.year||"")+(item.cohort?`(${item.cohort})`:"");
        badge.textContent=item.status||"";
        badge.className+=" "+(item.status?statusClass(item.status):"");

      }else if(currentTab==="nco"){
        avatar.textContent = item.emoji || "🪖";
        line1.innerHTML = item.company || "";
        line2.innerHTML = (item.dept||"") + " " + (item.name ? maskName(item.name) : "");
        badge.textContent = item.cohort || "";
        badge.className += " apprentice";

        const eliteUnits = [
          "707특수임무단","해군특수전전단(UDT)","해난구조전대(SSU)",
          "공군 제259특수임무대대(CCT)","제6탐색구조비행전대(SART)"
        ];
        if (eliteUnits.some(unit => (item.company||"").includes(unit))) {
          card.classList.add("elite");
        }

      }else if(currentTab==="admissions"){
        avatar.textContent = "🎓";
        line1.innerHTML = item.univ || "";

        const parts = [];
        if (item.major) parts.push(item.major);
        if (item.track) parts.push(item.track);
        if (item.name)  parts.push(maskName(item.name));
        line2.innerHTML = parts.join(" · ");

        badge.textContent = groupDisplay(item.category);
        if (item.category === "4년제대학" || item.category === "선취업후진학") {
          badge.classList.add("grand");
        }
        if (item.count && !item.name) {
          line2.innerHTML = (line2.innerHTML ? line2.innerHTML + " · " : "") + `${item.count}명`;
        }
        if (item.isPremier) card.classList.add("elite-univ");
      }

      meta.appendChild(line1); meta.appendChild(line2);
      card.appendChild(avatar); card.appendChild(meta); card.appendChild(badge);
      cards.appendChild(card);
    });

    page.appendChild(cards);
    viewport.appendChild(page);
    pages.push(page);

    const dot=document.createElement("div");
    dot.className="dot"+(idx===0?" active":"");
    dot.addEventListener("click",()=>{ stopAuto(); goToPage(idx); startAuto(); });
    dots.appendChild(dot);
  });

  pageIndex=0;
  updatePageInfo();
  extraInfo.textContent = isPaused ? "일시정지됨" : "자동 전환 중…";

  setupAutoFallbackObservers(currentTab);

  // 렌더 직후 다단계 자동 보정 (툴바/폰트 지연 흡수)
  if (autoFit) {
    autoFitRows();
    setTimeout(autoFitRows, 60);
    setTimeout(autoFitRows, 300);
  }
}

/* ========== 7) 페이지/자동전환 ========== */
function updatePageInfo(){
  const total=pages.length||1;
  pageInfo.textContent=`${pageIndex+1}/${total}`;
  [...dots.children].forEach((d,i)=>d.classList.toggle("active",i===pageIndex));
}
function goToPage(i){
  if(!pages.length) return;
  pages.forEach((p,idx)=>p.classList.toggle("active", idx===i));
  pageIndex=i; updatePageInfo();
}
function nextPage(){ if(pages.length) goToPage((pageIndex+1)%pages.length); }

function startAuto(){ stopAuto(); if(!isPaused) autoTimer=setInterval(nextAcross, AUTO_INTERVAL_MS); }
function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer=null; } }

/* ========== 8) 티커 렌더 ========== */
function renderTicker(tabKey){
  const localTicker = (typeof tickerTexts!=="undefined" && tickerTexts) ? (tickerTexts[tabKey]||[]) : [];
  const ticker = document.getElementById("ticker");
  if(!ticker) return;
  const once = localTicker.map((t,i)=>`<span>${t}</span>${i<localTicker.length-1?'<span>•</span>':''}`).join("");
  ticker.innerHTML = once + once;
}

// /* ========== 9) 터치: 일시정지 + 스와이프(상/하) ========== */
// let touchStartY=null;
// viewport.addEventListener("touchstart", e=>{
//   touchStartY=e.touches[0].clientY;
//   stopAuto();
//   extraInfo.textContent="일시정지(터치)";
// }, {passive:true});
// viewport.addEventListener("touchend", e=>{
//   if(touchStartY==null) return;
//   const dy=e.changedTouches[0].clientY - touchStartY;
//   if(Math.abs(dy)>40){ dy<0 ? nextPage() : goToPage((pageIndex-1+pages.length)%pages.length); }
//   touchStartY=null;
//   if(!isPaused){ startAuto(); extraInfo.textContent="자동 전환 중…"; }
// }, {passive:true});

/* ========== 9) 터치: 일시정지 + 스와이프(좌/우) ========== */
let touchStartX = null; // y 대신 x로 변경
viewport.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX; // clientY 대신 clientX 사용
    stopAuto();
    extraInfo.textContent = "일시정지(터치)";
}, { passive: true });
viewport.addEventListener("touchend", e => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX; // dy 대신 dx 사용
    if (Math.abs(dx) > 40) { // 임계값
        // 오른쪽으로 스와이프 (dx > 0) -> 이전 페이지
        // 왼쪽으로 스와이프 (dx < 0) -> 다음 페이지
        dx > 0 ? goToPage((pageIndex - 1 + pages.length) % pages.length) : nextPage();
    }
    touchStartX = null;
    if (!isPaused) {
        startAuto();
        extraInfo.textContent = "자동 전환 중…";
    }
}, { passive: true });

/* (터치 기기) 텍스트 선택/복사/꾹 클릭 메뉴 방지 */
(function () {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;
  const target = document.getElementById('viewport');
  const prevent = (e) => { e.preventDefault(); };
  ['contextmenu','selectstart','dragstart'].forEach(evt => target.addEventListener(evt, prevent, { passive:false }));
})();

/* ========== 10) 탭 전환/테마/일시정지 버튼 ========== */
document.getElementById("tab-awards").addEventListener("click", ()=>setActiveTab("awards"));
document.getElementById("tab-jobs").addEventListener("click", ()=>setActiveTab("jobs"));
document.getElementById("tab-doje").addEventListener("click", ()=>setActiveTab("doje"));
document.getElementById("tab-nco").addEventListener("click", ()=>setActiveTab("nco"));
document.getElementById("tab-admissions").addEventListener("click", ()=>setActiveTab("admissions"));
function setActiveTab(key){
  viewport.classList.add("fadeout");
  setTimeout(()=>{
    currentTab=key;
    document.getElementById("tab-awards").classList.toggle("active", key==="awards");
    document.getElementById("tab-jobs").classList.toggle("active", key==="jobs");
    document.getElementById("tab-doje").classList.toggle("active", key==="doje");
    document.getElementById("tab-nco").classList.toggle("active", key==="nco");
    document.getElementById("tab-admissions").classList.toggle("active", key==="admissions");
    render(true);
    renderTicker(key);
    setupAutoFallbackObservers(key);
    if(!isPaused) startAuto();
    viewport.classList.remove("fadeout");
  }, 350);

}

const btnTheme = document.getElementById("btnTheme");
btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("light");
  btnTheme.textContent = document.body.classList.contains("light") ? "☀️ 라이트모드" : "🌙 다크모드";
});

document.getElementById("btnTogglePlay").addEventListener("click", ()=>{
  isPaused = !isPaused;
  if(isPaused){
    stopAuto();
    document.getElementById("btnTogglePlay").textContent="▶️ 다시재생";
    extraInfo.textContent="일시정지됨";
  }else{
    document.getElementById("btnTogglePlay").textContent="⏸️ 일시정지";
    extraInfo.textContent="자동 전환 중…";
    startAuto();
  }
});

/* ========== 11) 리사이즈 시 재계산 ========== */
window.addEventListener("resize", ()=>{ render(true); if(!isPaused) startAuto(); });

/* ========== 12) 초기 구동 ========== */
render(true);
renderTicker(currentTab);
startAuto();

/* ========== 13) 한 번에 보기 (동일 탭) ========== */
document.getElementById('openOverview').addEventListener('click', () => {
  location.href = `overview.html?tab=${encodeURIComponent(currentTab)}`;
});
