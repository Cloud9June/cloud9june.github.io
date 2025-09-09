/* =========================================================
   성일정보고 성과 & 취업 현황 - 메인 스크립트
   - 최종본 버전1
   ========================================================= */

/* --- 실제 보이는 viewport 높이를 CSS 변수로 주입 --- */
function setVH(){
  const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--vh', `${h}px`);
}
setVH();
window.addEventListener('resize', setVH);
if (window.visualViewport) window.visualViewport.addEventListener('resize', setVH);

/* --- 데이터 로드 (data.js) 후 사용 --- */
// data.js가 awards/jobs/doje/nco/admissions, (옵션) tickerTexts를 제공한다고 가정

/* --- 유틸: 이름 마스킹 --- */
const maskName = (name) => {
  if (!name) return "";
  return String(name).split(/[,\n]+/g).map(n=>{
    const arr=[...n.trim()];
    if(arr.length===2) return arr[0]+"○";
    if(arr.length>=3) return arr[0]+"○"+arr.slice(2).join("");
    return n.trim();
  }).join(", ");
};

/* --- 유틸: 인원수 계산 --- */
function countPeople(name){
  if(!name) return 0;
  const m = String(name).match(/총\s*([0-9]+)\s*명/);
  if(m) return parseInt(m[1],10);
  return String(name).split(/[,\n]+/g).map(s=>s.trim()).filter(Boolean).length;
}

/* --- 유틸: 배지/타입/상태 클래스 --- */
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

/* --- 반응형: 페이지 크기 계산 (행 수) --- */
function computePageSizeByHeight(availHeightPx){
  const perRow = (window.innerWidth <= 480) ? 68 : 110; // 기기별 카드 예상 높이
  const raw = Math.floor(availHeightPx / perRow);
  const clamped = Math.max(3, Math.min(12, raw));
  const candidates=[12,10,9,8,7,6,5,4,3];
  let best=clamped, diff=Infinity;
  for(const n of candidates){
    const d=Math.abs(n-clamped);
    if(d<diff){ diff=d; best=n; }
  }
  return best;
}
function getResponsivePageSize(){
  const rect = viewport.getBoundingClientRect();
  return computePageSizeByHeight(rect.height);
}

/* --- 유틸: 진학 카운팅 규칙 --- */
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

/* --- 전역 상태 --- */
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

/* --- 자동 순환 탭 순서 --- */
const TAB_ORDER = ["awards", "jobs", "doje", "nco", "admissions"];

/* --- 효과 토글 초기값 ON --- */
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

/* --- NCO 정렬 키 (동아리/학과 규칙) --- */
function getNcoSortKey(cohort){
  if(!cohort) return 999;
  let num = parseInt(cohort.replace(/[^0-9]/g,""), 10);
  if(cohort.includes("동아리")){
    return num - 9; // 14 -> 5, 15 -> 6
  }else{
    return num;     // 부사관과 그대로
  }
}

/* --- 탭 자동 넘김(페이지 끝나면 다음 탭으로) --- */
function nextAcross(){
  if (pages.length && pageIndex < pages.length - 1) {
    goToPage(pageIndex + 1);
  } else {
    const i = TAB_ORDER.indexOf(currentTab);
    const nextTab = TAB_ORDER[(i + 1) % TAB_ORDER.length];
    setActiveTab(nextTab); // setActiveTab이 render() 호출
  }
}

/* --- 배열을 페이지로 나누기 --- */
const chunk = (arr,size)=>arr.reduce((acc,_,i)=>(i%size?acc:acc.concat([arr.slice(i,i+size)])),[]);

/* --- 렌더링 --- */
function render(){
  let data =
    currentTab==="awards" ? awards :
    currentTab==="jobs"   ? jobs   :
    currentTab==="doje"   ? doje   :
    currentTab==="nco"    ? nco    :
                            admissions;

  if(currentTab==="nco"){
    // 최신/뒷기수 먼저 보이게 (내림차순)
    data = [...data].sort((a,b)=>getNcoSortKey(b.cohort) - getNcoSortKey(a.cohort));
  }

  // 총 인원 표시
  const totalCount =
    currentTab==="awards" ? awards.reduce((s,it)=>s+countPeople(it.name),0) :
    currentTab==="doje"   ? doje.reduce((s,it)=>s+countPeople(it.name),0)   :
    currentTab==="nco"    ? data.length :
    currentTab==="admissions" ? admissions.reduce((s,it)=>s + admissionsCountItem(it), 0) :
                                jobs.length;
  countTotal.textContent=totalCount;

  // 페이지 크기 계산
  PAGE_SIZE = getResponsivePageSize();

  // 페이지/도트 초기화
  viewport.innerHTML = "";
  dots.innerHTML = "";
  pages = [];

  // 페이지 단위로 DOM 구성
  const ch = chunk(data, PAGE_SIZE);
  ch.forEach((group, idx)=>{
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

        if (item.isPremier) card.classList.add("elite-award");

      }else if(currentTab==="jobs"){
        avatar.textContent=item.emoji||"🏢";
        line1.innerHTML=item.company||"";
        line2.innerHTML=(item.dept||"")+" "+(item.name?maskName(item.name):"");
        badge.textContent=item.type||"";
        badge.className+=" "+(item.type?typeClass(item.type):"");

      }else if(currentTab==="doje"){
        avatar.textContent="🧑🏻‍💻";
        line1.innerHTML=item.company||"";
        line2.innerHTML=(item.dept||"")+" "+(item.name?maskName(item.name):"")+" · "+(item.year||"")+(item.cohort?`(${item.cohort})`:"");
        badge.textContent=item.status||"";
        badge.className+=" "+(item.status?statusClass(item.status):"");

      }else if(currentTab==="nco"){
        avatar.textContent=item.emoji||"🪖";
        line1.innerHTML=item.company||"";
        line2.innerHTML=(item.dept||"")+" "+(item.name?maskName(item.name):"");
        badge.textContent=item.cohort||"";
        badge.className+=" apprentice";

        // 특수부대 강조
        const eliteUnits=["707특수임무단","해군특수전전단(UDT)","해난구조전대(SSU)","공군 제259특수임무대대(CCT)","제6탐색구조비행전대(SART)"];
        if (eliteUnits.some(unit => (item.company||"").includes(unit))) card.classList.add("elite");

      }else if(currentTab==="admissions"){
        avatar.textContent="🎓";
        line1.innerHTML=item.univ||"";

        const parts=[];
        if (item.major) parts.push(item.major);
        if (item.track) parts.push(item.track);
        if (item.name)  parts.push(maskName(item.name));
        line2.innerHTML=parts.join(" · ");

        badge.textContent=groupDisplay(item.category);
        if (item.category==="4년제대학" || item.category==="선취업후진학") badge.classList.add("grand");
        if (item.count && !item.name) line2.innerHTML=(line2.innerHTML?line2.innerHTML+" · ":"")+`${item.count}명`;

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
}

/* --- 페이지 정보/도트 업데이트 --- */
function updatePageInfo(){
  const total=pages.length||1;
  pageInfo.textContent=`${pageIndex+1}/${total}`;
  [...dots.children].forEach((d,i)=>d.classList.toggle("active",i===pageIndex));
}

/* --- 페이지 이동 --- */
function goToPage(i){
  if(!pages.length) return;
  pages.forEach((p,idx)=>p.classList.toggle("active", idx===i));
  pageIndex=i; updatePageInfo();
}
function nextPage(){ if(pages.length) goToPage((pageIndex+1)%pages.length); }

/* --- 자동 전환 --- */
function startAuto(){ stopAuto(); if(!isPaused) autoTimer=setInterval(nextAcross, AUTO_INTERVAL_MS); }
function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer=null; } }

/* --- 티커 텍스트 렌더 (data.js에서 tickerTexts 제공 시) --- */
function renderTicker(tabKey){
  const localTicker = (typeof tickerTexts!=="undefined" && tickerTexts) ? (tickerTexts[tabKey]||[]) : [];
  const ticker = document.getElementById("ticker");
  if(!ticker) return;
  const once = localTicker.map((t,i)=>`<span>${t}</span>${i<localTicker.length-1?'<span>•</span>':''}`).join("");
  ticker.innerHTML = once + once;
}

/* --- 스와이프(터치) --- */
let touchStartY=null;
viewport.addEventListener("touchstart", e=>{
  touchStartY=e.touches[0].clientY;
  stopAuto();
  extraInfo.textContent="일시정지(터치)";
}, {passive:true});
viewport.addEventListener("touchend", e=>{
  if(touchStartY==null) return;
  const dy=e.changedTouches[0].clientY - touchStartY;
  if(Math.abs(dy)>40){ dy<0 ? nextPage() : goToPage((pageIndex-1+pages.length)%pages.length); }
  touchStartY=null;
  if(!isPaused){ startAuto(); extraInfo.textContent="자동 전환 중…"; }
}, {passive:true});

/* --- 터치 기기에서 텍스트 선택/복사/꾹 클릭 메뉴 방지 --- */
(function () {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;
  const target = document.getElementById('viewport'); // 필요 시 document로 확대 가능
  const prevent = (e) => { e.preventDefault(); };
  ['contextmenu','selectstart','dragstart'].forEach(evt => target.addEventListener(evt, prevent, { passive:false }));
})();

/* --- 탭 전환 --- */
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
    render();
    renderTicker(key);
    if(!isPaused) startAuto();
    viewport.classList.remove("fadeout");
  }, 350);
}

/* --- 테마 토글 --- */
const btnTheme = document.getElementById("btnTheme");
btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("light");
  btnTheme.textContent = document.body.classList.contains("light") ? "☀️ 라이트모드" : "🌙 다크모드";
});

/* --- 일시정지/재생 --- */
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

/* --- 리사이즈: 레이아웃 재계산 --- */
window.addEventListener("resize", ()=>{ render(); if(!isPaused) startAuto(); });

/* --- 초기 렌더 --- */
render();
renderTicker(currentTab);
startAuto();

/* --- 한 번에 보기: 동일 탭으로 overview.html 이동 (새탭 아님) --- */
document.getElementById('openOverview').addEventListener('click', () => {
  location.href = `overview.html?tab=${encodeURIComponent(currentTab)}`;
});