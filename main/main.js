/*
==========================================
 성일정보고 링크 허브 스크립트
------------------------------------------
 ⦿ 제작자 : 성일정보고등학교 교육정보부장 김형준
 ⦿ 최초 작성 : 2025-09-15
 ⦿ 수정 내역 : 
    - 2025-09-22 카드 숨김/복원 기능 추가
    - 2025-09-22 메모장 모달 CRUD 기능 구현
    - 2025-10-15 오늘일정 기능 구현
------------------------------------------
 본 소스는 성일정보고 내부 업무 지원용으로 작성되었으며
 무단 사용 및 외부 배포를 금합니다.
==========================================
*/

// 안전 selector & 바인딩 헬퍼
const $ = (id) => document.getElementById(id);
const on = (el, evt, handler, opts) => {
    if (el) el.addEventListener(evt, handler, opts);
    // else console.warn(`[bind skipped] ${evt} on`, el);
};
// 연도
document.getElementById('yy').textContent = new Date().getFullYear();

// 검색 & 카테고리 필터
const q = document.getElementById('q');
const cards = [...document.querySelectorAll('.card')];
const pills = [...document.querySelectorAll('.pill')];
let hiddenCards = JSON.parse(localStorage.getItem("eduinfo.hiddenCards") || "[]");
let activeCat = 'all';

function applyFilter() {
    const keyword = (q.value || '').trim().toLowerCase();
    cards.forEach(c => {
        const key = c.dataset.key; // ✅ 여기서 key 정의
        const tags = (c.dataset.tags || '').toLowerCase();
        const inCat = activeCat === 'all' ? true : (c.dataset.cat === activeCat);
        const hit = !keyword || tags.includes(keyword) || c.querySelector('h3').textContent.toLowerCase().includes(keyword);

        // 🚨 숨김 카드 처리 추가
        const isHidden = hiddenCards.includes(key);

        c.style.display = (!isHidden && inCat && hit) ? '' : 'none';
    });
}

q.addEventListener('input', applyFilter);
pills.forEach(p => {
    p.addEventListener('click', () => {
        activeCat = p.dataset.filter;
        pills.forEach(x => x.style.outline = '');
        p.style.outline = '2px solid var(--accent)';
        applyFilter();
    });
});

applyFilter();


// 기본 선택 표시 (배열 길이 보장용)
pills[0]?.style && (pills[0].style.outline = '2px solid var(--accent)');

// ===== 전광판 =====
const track = $('ledTrack');
const ticker = $('ledTicker');
const toggleBtn = $('tickerToggle');

function sep() {
    const s = document.createElement('span');
    s.className = 'led-sep';
    return s;
}
const achievements = [
    "🏆 2025년 제15회 전국상업경진대회 비즈니스프로그래밍 은상 - 양○욱",
    "🏆 2025년 제15회 전국상업경진대회 세무실무 은상 — 장○호",
    "🏆 2025년 제15회 전국상업경진대회 금융실무 동상 - 장○우",
    "🫡 2025학년도 부사관반 재학생 전원 합격(공군24명, 육군22명, 해병대2명)",
    "🏢 메리츠증권·하나은행·새마을금고·기보·aT 공사 등 취업 소식"
];

function renderTicker() {
    if (!track) return;
    track.innerHTML = "";
    track.appendChild(sep());
    achievements.forEach(msg => {
        const span = document.createElement('span');
        span.textContent = " " + msg + " ";
        track.appendChild(span);
        track.appendChild(sep());
    });
    const chars = achievements.join("  ").length;
    const speed = Math.max(20, Math.min(45, Math.round(chars / 6)));
    track.style.animation = `ledScroll ${speed}s linear infinite`;
}

function openTicker() {
    if (!ticker || !toggleBtn) return;
    ticker.classList.add('is-open');
    ticker.setAttribute('aria-hidden', 'false');
    toggleBtn.textContent = '📢 학교 알림 전광판 닫기';
    renderTicker();
}

function closeTicker() {
    if (!ticker || !toggleBtn || !track) return;
    ticker.classList.remove('is-open');
    ticker.setAttribute('aria-hidden', 'true');
    toggleBtn.textContent = '📢 학교 알림 전광판 열기';
    track.style.animation = 'none';
}
on(toggleBtn, 'click', () => ticker.classList.contains('is-open') ? closeTicker() : openTicker());
// on(track, 'focus', () => track.style.animationPlayState = 'paused');
on(track, 'blur', () => track.style.animationPlayState = 'running');
on(ticker, 'mouseenter', () => track && (track.style.animationPlayState = 'paused'));
on(ticker, 'mouseleave', () => track && (track.style.animationPlayState = 'running'));

// ===== 상단 빠른 검색바 (중복 방지+엔터 한 번만) =====
(function () {
    if (window.__qsBound) return;
    window.__qsBound = true;
    const input = $('qsInput'),
        gBtn = $('qsGoogle'),
        nBtn = $('qsNaver');
    const DEFAULT_KEY = 'eduinfo.search.default';
    let defaultEngine = localStorage.getItem(DEFAULT_KEY) || 'google';
    const OPEN_LOCK_MS = 600;
    let lastOpenAt = 0;

    function highlight() {
        if (!gBtn || !nBtn) return;
        gBtn.style.outline = (defaultEngine === 'google') ? '2px solid var(--accent)' : '';
        nBtn.style.outline = (defaultEngine === 'naver') ? '2px solid var(--accent)' : '';
    }

    function openSearch(engine, q) {
        if (!input) return;
        if (!q) {
            input.focus();
            return;
        }
        const now = Date.now();
        if (now - lastOpenAt < OPEN_LOCK_MS) return;
        lastOpenAt = now;
        const enc = encodeURIComponent(q.trim());
        const url = (engine === 'naver') ?
            `https://search.naver.com/search.naver?query=${enc}` :
            `https://www.google.com/search?q=${enc}`;
        window.open(url, '_blank', 'noopener');
        localStorage.setItem(DEFAULT_KEY, engine);
        defaultEngine = engine;
        highlight();

        input.value = "";
    }
    // 검색창 전체 클릭 → input 포커스
    const qsWrap = document.querySelector('.quick-search');
    const qsInput = document.getElementById('qsInput');

    if (qsWrap && qsInput) {
    qsWrap.addEventListener('click', (e) => {
        // 버튼 누른 건 무시
        if (e.target.tagName.toLowerCase() !== 'button') {
        qsInput.focus();
        }
    });
    }

    function smart() {
        if (!input) return;
        const val = (input.value || '').trim();
        if (!val) {
            input.focus();
            return;
        }
        const m = val.match(/^([gnGNㄱㄴㅎㅜ])\s+(.*)$/);
        if (m) {
            const k = m[1].toLowerCase();
            const eng = (k === 'g' || k === 'ㄱ' || k === 'ㅎ') ? 'google' : (k === 'n' || k === 'ㄴ' || k === 'ㅜ') ? 'naver' :
                defaultEngine;
            openSearch(eng, m[2]);
        } else openSearch(defaultEngine, val);
    }

    on(input, 'keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.isComposing) return;
            e.preventDefault();
            e.stopPropagation();
            smart();
        }
    }, {
        passive: false
    });
    on(gBtn, 'click', () => openSearch('google', input && input.value));
    on(nBtn, 'click', () => openSearch('naver', input && input.value));
    highlight();
})();

// ===== 오늘 급식 (NEIS) =====
(function () {
const textEl = $('todayMealText');
if (!textEl) return;

const officeCode = "J10",
schoolCode = "7530591",
key = "86d5824114ac4902a87d57ce9146867d";

const CACHE_KEY = "todayMealCache";

function todayYMD() {
const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const y = kst.getFullYear(),
m = String(kst.getMonth() + 1).padStart(2, '0'),
d = String(kst.getDate()).padStart(2, '0');
return `${y}${m}${d}`;
}

function formatMenu(s) {
if (!s) return '';
return s.replace(/<br\s*\/?>/gi, ' · ' ) .replace(/\([^)]*\)/g, '' ) .replace(/\b\d+\./g, '' )
    .replace(/\s{2,}/g, ' ' ) .trim(); } async function fetchMeal() { const ymd=todayYMD(); const
    url=`https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${encodeURIComponent(key)}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${ymd}&MLSV_TO_YMD=${ymd}`;
    try { const res=await fetch(url); const data=await res.json(); if (data &&
    Array.isArray(data.mealServiceDietInfo)) { const withRow=data.mealServiceDietInfo.find(x=>
    Array.isArray(x.row));
    const rows = withRow ? withRow.row : [];
    if (rows.length) {
    const target = rows.find(r => (r.MMEAL_SC_NM || '').includes('중식')) || rows[0];
    const text = formatMenu(target && target.DDISH_NM);
    return text || null;
    }
    }
    } catch (e) {
    console.warn("급식 불러오기 실패:", e);
    }
    return null;
    }

    async function loadMeal() {
    const today = todayYMD();

    // 1) 캐시 먼저 확인
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    if (cache.date === today && cache.text) {
        textEl.textContent = cache.text; // 즉시 표시
        return;
    } else {
        textEl.textContent = "🍚 오늘은 어떤 반찬이 기다릴까요? 로딩 중...";
    }

    // 2) 백그라운드에서 새로 요청
    const text = await fetchMeal();
    if (text) {
        textEl.textContent = text;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, text }));
    } else {
        textEl.textContent = "🥳 급식은 없지만, 대신 더 많은 자유가 기다립니다!";
        localStorage.removeItem(CACHE_KEY);
    }
    }

    loadMeal();
})();

// Accordion 동작
document.querySelectorAll('.accordion-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if (btn.classList.contains('active')) {
            content.style.maxHeight = content.scrollHeight + "px";
        } else {
            content.style.maxHeight = null;
        }
    });
});

// ===== 실시간 시계(KST) =====
(function () {
    // const $ = (id) => document.getElementById(id);
    const elDate = $('nowDate');
    const elTime = $('nowTime');
    if (!elDate || !elTime) return;

    const DOW = ['일','월','화','수','목','금','토'];
    const two = (n) => String(n).padStart(2, '0');

    function nowKST() {
        // 브라우저 지역과 무관하게 한국시간
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    }

    function render() {
        const d = nowKST();
        const y = d.getFullYear();
        const m = two(d.getMonth() + 1);
        const day = two(d.getDate());
        const w = DOW[d.getDay()];
        const hh = two(d.getHours());
        const mm = two(d.getMinutes());
        const ss = two(d.getSeconds());

        elDate.textContent = `${y}.${m}.${day} (${w})`;
        elTime.textContent = `${hh}:${mm}:${ss}`;
    }

    render();
    // 초 경계에 맞춰 부드럽게: 다음 초까지 맞춘 뒤 1초 간격
    const firstDelay = 1000 - (nowKST().getMilliseconds());
    setTimeout(() => {
        render();
        setInterval(render, 1000);
    }, firstDelay);
})();

// ===== 실시간 날씨(기상청API) =====
async function fetchWeather(isRetry = false, manualDate = null, manualTime = null) {
    const SERVICE_KEY = "ed175a454d98c792477c333a80a7305d1f49e0ef31e8a3d75110c111023879bd";
    const nx = 62, ny = 124; // 성남 좌표

    // 현재 한국 시각
    let kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    let yyyy = kst.getFullYear();
    let mm = String(kst.getMonth() + 1).padStart(2, "0");
    let dd = String(kst.getDate()).padStart(2, "0");
    let base_date = `${yyyy}${mm}${dd}`;

    // 내일 날짜
    const tomorrow = new Date(kst);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tyyyy = tomorrow.getFullYear();
    const tmm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const tdd = String(tomorrow.getDate()).padStart(2, "0");
    const tomorrow_date = `${tyyyy}${tmm}${tdd}`;

    // 단기예보는 02:00, 05:00, 08:00 ...
    const baseTimes = ["0200","0500","0800","1100","1400","1700","2000","2300"];
    const hh = kst.getHours() * 100 + kst.getMinutes();
    let base_time = baseTimes[0];
    for (let t of baseTimes) {
        if (hh >= parseInt(t)) base_time = t;
    }

    // 발표 40분 전후 시에는 이전 발표분으로 보정
    if (kst.getMinutes() < 40 && !manualTime) {
        const idx = baseTimes.indexOf(base_time);
        if (idx > 0) {
            base_time = baseTimes[idx - 1];
        } else {
            kst.setDate(kst.getDate() - 1);
            yyyy = kst.getFullYear();
            mm = String(kst.getMonth() + 1).padStart(2, "0");
            dd = String(kst.getDate()).padStart(2, "0");
            base_date = `${yyyy}${mm}${dd}`;
            base_time = "2300";
        }
    }

    // 수동 재시도 시
    if (manualDate) base_date = manualDate;
    if (manualTime) base_time = manualTime;

    const url =
        `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
        `?serviceKey=${SERVICE_KEY}&numOfRows=1000&pageNo=1&dataType=JSON` +
        `&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data?.response?.body?.items?.item;

        if (!items?.length) {
            // ⚠️ 데이터가 비어있을 경우: 한 번만 이전 발표시각으로 재시도
            if (!isRetry) {
                const prev = getPreviousBaseTime(base_date, base_time);
                return await fetchWeather(true, prev.date, prev.time);
            }
            throw new Error("no_data");
        }

        // ===== 오늘 날씨 =====
        const hhNow = String(kst.getHours()).padStart(2,"0") + "00";
        const todayList = items.filter(i => i.fcstDate === base_date);
        const nearest = todayList.find(i => i.fcstTime >= hhNow) || todayList[0];

        const sky = nearest?.category === "SKY" ? nearest.fcstValue :
                    todayList.find(i => i.category === "SKY")?.fcstValue;
        const pty = todayList.find(i => i.category === "PTY")?.fcstValue;
        const tmp = todayList.find(i => i.category === "TMP")?.fcstValue;
        const reh = todayList.find(i => i.category === "REH")?.fcstValue;

        document.getElementById("todayWeather").innerHTML =
            `${getWeatherIcon(sky, pty)} ${tmp ?? "-"}℃ · ${reh ?? "-"}%`;

        // ===== 내일 (최저/최고 TMP) =====
        const tomorrowTemps = items
            .filter(i => i.fcstDate === tomorrow_date && i.category === "TMP")
            .map(i => Number(i.fcstValue));

        if (tomorrowTemps.length > 0) {
            const tmin = Math.min(...tomorrowTemps);
            const tmax = Math.max(...tomorrowTemps);
            document.getElementById("tomorrowWeather").textContent =
                `내일 ${tmin}℃ / ${tmax}℃`;
        } else {
            document.getElementById("tomorrowWeather").textContent = "";
        }

    } catch {
        // ❗ 완전 실패해도 오류 메시지 없이 조용히 표시 유지
        document.getElementById("todayWeather").innerHTML = "-";
        document.getElementById("tomorrowWeather").textContent = "";
    }
}

// 🔁 직전 발표시각 계산 보조 함수
function getPreviousBaseTime(base_date, base_time) {
    const baseTimes = ["0200","0500","0800","1100","1400","1700","2000","2300"];
    const idx = baseTimes.indexOf(base_time);
    let date = base_date;
    let time = "2300";
    if (idx > 0) {
        time = baseTimes[idx - 1];
    } else {
        const d = new Date(
            `${base_date.slice(0,4)}-${base_date.slice(4,6)}-${base_date.slice(6,8)}T00:00:00`
        );
        d.setDate(d.getDate() - 1);
        date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    }
    return { date, time };
}


// 아이콘 매핑
function getWeatherIcon(sky, pty) {
    if (pty == 1) return '<i class="fa-solid fa-cloud-rain"></i>';          // 비
    if (pty == 2) return '<i class="fa-solid fa-cloud-showers-heavy"></i>'; // 비/눈
    if (pty == 3) return '<i class="fa-solid fa-snowflake"></i>';           // 눈
    if (pty == 4) return '<i class="fa-solid fa-cloud-sun-rain"></i>';      // 소나기

    if (sky == 1) return '<i class="fa-solid fa-sun"></i>';                 // 맑음
    if (sky == 3) return '<i class="fa-solid fa-cloud-sun"></i>';           // 구름많음
    if (sky == 4) return '<i class="fa-solid fa-cloud"></i>';               // 흐림

    return '<i class="fa-solid fa-temperature-half"></i>'; // 기본값
}

// 실행
fetchWeather();
setInterval(fetchWeather, 30 * 60 * 1000); // 30분마다 갱신



// ===== 개인화 카드 =====
(function(){
    const STORAGE_KEY = "eduinfo.personalLinks";
    const container = document.getElementById("personalLinks");
    const addBtn = document.getElementById("addLinkBtn");
    const manageBtn = document.getElementById("manageLinkBtn");
    const deleteMode = document.getElementById("deleteMode");

    function getLinks() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    }
    function saveLinks(links) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    }

    function renderLinks() {
        container.innerHTML = "";
        const links = getLinks();
        if (links.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.textContent = "아직 추가한 링크가 없습니다.";
        emptyMsg.style.color = "var(--muted)";
        emptyMsg.style.fontSize = "13px";
        container.appendChild(emptyMsg);
        return;
        }
        links.forEach(link => {
        const a = document.createElement("a");
        a.className = "btn";
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = link.name;
        container.appendChild(a);
        });
    }

    function addLink() {
        let name = prompt("링크 이름을 입력하세요 (최대 10자):");
        if (!name) return;

        // 🔒 글자수 제한 적용
        name = name.trim().slice(0, 10);

        if (name.length === 0) {
            alert("이름을 입력하세요.");
            return;
        }

        const url = prompt("URL을 입력하세요 (http:// 또는 https:// 포함):");
        if (!url) return;

        const links = getLinks();
        links.push({ name, url });
        saveLinks(links);
        renderLinks();
    }

    function toggleDeleteMode() {
        if (deleteMode.style.display === "none") {
        // 삭제 모드 열기
        deleteMode.style.display = "block";
        deleteMode.innerHTML = "<p style='font-size:13px;color:var(--muted)'>삭제할 링크를 선택하세요:</p>";
        const links = getLinks();
        links.forEach((link, i) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.gap = "6px";
            row.style.marginBottom = "6px";

            const label = document.createElement("span");
            label.textContent = link.name;
            label.style.flex = "1";

            const delBtn = document.createElement("button");
            delBtn.className = "btn";
            delBtn.style.background = "#2a3a4f";
            delBtn.textContent = "❌ 삭제";
            delBtn.onclick = () => {
            links.splice(i, 1);
            saveLinks(links);
            renderLinks();
            toggleDeleteMode(); // 리스트 다시 갱신
            };

            row.appendChild(label);
            row.appendChild(delBtn);
            deleteMode.appendChild(row);
        });
        } else {
        // 삭제 모드 닫기
        deleteMode.style.display = "none";
        deleteMode.innerHTML = "";
        }
    }

    addBtn.addEventListener("click", addLink);
    manageBtn.addEventListener("click", toggleDeleteMode);

    renderLinks();
})();

// ===== 개인화 순서 =====
// 저장
function saveOrder() {
    const keys = [...document.querySelectorAll("#grid .card")]
        .map(c => c.dataset.key);
    localStorage.setItem("eduinfo.cardOrder", JSON.stringify(keys));
}

function loadOrder() {
    const order = JSON.parse(localStorage.getItem("eduinfo.cardOrder") || "[]");
    const grid = document.getElementById("grid");
    order.forEach(key => {
        const el = document.querySelector(`#grid .card[data-key="${key}"]`);
        if (el) grid.appendChild(el);
    });
}
// 초기 실행
loadOrder();

// Sortable 활성화
let sortable = new Sortable(document.getElementById("grid"), {
    animation: 200,
    ghostClass: "ghost",
    chosenClass: "chosen",
    delay: 150,             // 150ms 이상 눌러야 드래그 시작
    delayOnTouchOnly: true, // 모바일 터치에서만 지연 적용
    onEnd: saveOrder
});

function toggleLock() {
    let isLocked = localStorage.getItem("eduinfo.locked") === "true"; // 저장된 값 불러오기
    isLocked = !isLocked; // 반전
    sortable.option("disabled", isLocked); // 잠금/해제 적용
    localStorage.setItem("eduinfo.locked", isLocked); // 상태 저장
    document.getElementById("lockBtn").textContent = isLocked ? "🔒 카드 고정" : "🔓 카드 해제";
}

// 초기 상태 로드
(function () {
    let isLocked = localStorage.getItem("eduinfo.locked") === "true";
    sortable.option("disabled", isLocked);
    document.getElementById("lockBtn").textContent = isLocked ? "🔒 카드 고정" : "🔓 카드 해제";
})();

// 도움말 모달 열기/닫기
const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelp = document.getElementById("closeHelp");

const dutyBtn = document.getElementById("dutyBtn");
const dutyModal = document.getElementById("dutyModal");
const closeDutyBtn = document.getElementById("closeDutyBtn");

const memoModal = document.getElementById("memoModal");


dutyBtn.addEventListener("click", () => {
    dutyModal.style.display = "flex";
});

closeDutyBtn.addEventListener("click", () => {
    dutyModal.style.display = "none";
});
closeDuty.addEventListener("click", () => {
    dutyModal.style.display = "none";
})

helpBtn.addEventListener("click", () => {
    helpModal.style.display = "block";
});

closeHelp.addEventListener("click", () => {
    helpModal.style.display = "none";
});

window.addEventListener("click", (e) => {
    if (e.target === helpModal || e.target === dutyModal || e.target === memoModal) {
        helpModal.style.display = "none";
        dutyModal.style.display = "none";
        memoModal.style.display = "none";
    }
});

async function loadDuty() {
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3jc-6ORNFCO2KGxiAJdvZ87JLAyTDgOxEEd2atN4q38jWjGAdBbT4q1LaIMnz2q68-8K9i1JR0yNs/pub?gid=0&single=true&output=csv";
    const res = await fetch(url);
    const text = await res.text();
    const rows = text.trim().split("\n").map(r => r.split(","));

    // 오늘 데이터 ------------------
    let today = rows[0][0];
    let jubun = rows[3][0];
    let gyotong = rows[7][0];
    let jubunGyotong = (jubun === gyotong) ? jubun : `${jubun}, ${gyotong}`;
    let gupsikA = [rows[3][3], rows[4][3]].filter(v => v).join(", ");
    let gupsikB = [rows[7][3], rows[8][3]].filter(v => v).join(", ");
    let yaja = [rows[3][6], rows[4][6]].filter(v => v).join(", ");

    // 내일 데이터 ------------------
    let tomorrow = rows[11][0];
    let jubun2 = rows[14][0];
    let gyotong2 = rows[18][0];
    let jubunGyotong2 = (jubun2 === gyotong2) ? jubun2 : `${jubun2}, ${gyotong2}`;
    let gupsikA2 = [rows[14][3], rows[15][3]].filter(v => v).join(", ");
    let gupsikB2 = [rows[18][3], rows[19][3]].filter(v => v).join(", ");
    let yaja2 = [rows[14][6], rows[15][6]].filter(v => v).join(", ");

    // ✅ 표 구조로 HTML 생성
    let html = `
    <table class="duty-table">
        <thead>
        <tr>
            <th></th>
            <th>${today}</th>
            <th>${tomorrow}</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>주번/교통</td>
            <td>${jubunGyotong}</td>
            <td>${jubunGyotong2}</td>
        </tr>
        <tr>
            <td>급식A</td>
            <td>${gupsikA}</td>
            <td>${gupsikA2}</td>
        </tr>
        <tr>
            <td>급식B</td>
            <td>${gupsikB}</td>
            <td>${gupsikB2}</td>
        </tr>
        <tr>
            <td>야자[당직]</td>
            <td>${yaja}</td>
            <td>${yaja2}</td>
        </tr>
        </tbody>
    </table>
    `;

    document.getElementById("modal-duty").innerHTML = html;
}
loadDuty();

const scheduleBtn = document.getElementById("scheduleBtn");
const scheduleModal = document.getElementById("scheduleModal");
const closeSchedule = document.getElementById("closeSchedule");
const closeScheduleBtn = document.getElementById("closeScheduleBtn");

// 오늘일정 버튼 클릭 → 모달 열기
scheduleBtn.addEventListener("click", () => {
  scheduleModal.style.display = "flex";
  loadSchedule(); // 데이터 로드
});

// 닫기 버튼
closeSchedule.addEventListener("click", () => {
  scheduleModal.style.display = "none";
});
closeScheduleBtn.addEventListener("click", () => {
  scheduleModal.style.display = "none";
});

async function loadSchedule() {
  // ✅ 오늘일정 시트의 CSV 주소
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVGElXniOyF3A9SaK2l_8Zm6omPzbialdK8pCdeI5QuEiRXcOMC8ylwNHFI8coP8rfvykhcVwC08pe/pub?gid=0&single=true&output=csv";

  try {
    const res = await fetch(url);
    let text = await res.text();

    // 🔹 CSV 전처리 (BOM, 따옴표, 불필요한 문자 제거)
    text = text
      .replace(/^\uFEFF/, "")      // BOM 제거
      .replace(/^"+|"+$/g, "")     // 맨 앞/뒤 큰따옴표 제거
      .replace(/""+/g, '"')        // 중복 따옴표 정리
      .replace(/\r/g, "")          // 캐리지리턴 제거
      .trim();

    // 🔹 줄 단위 분리
    const lines = text.split("\n");
    const title = lines[0]?.trim() || "오늘의 일정";
    const desc = lines.slice(1).join("\n").trim();

    // ✅ [부서] 단위로 구간 묶기
    const blocks = [];
    let currentDept = null;
    let currentContent = [];

    const allLines = desc.split("\n");
    for (let line of allLines) {
      // 🔸 첫 줄 특수문자/BOM/따옴표 제거
      line = line.replace(/^[\uFEFF"']+/, "").trim();

      const deptMatch = line.match(/^\[([^\]]+)\]\s*(.*)/);
      if (deptMatch) {
        // 새로운 [부서] 등장 시 이전 블록 저장
        if (currentDept) {
          blocks.push({
            dept: currentDept,
            content: currentContent.join("<br>")
          });
        }
        currentDept = deptMatch[1];
        currentContent = [deptMatch[2]];
      } else if (currentDept) {
        // 부서 구간 내부의 추가 줄
        currentContent.push(line);
      }
    }

    // 마지막 블록 저장
    if (currentDept) {
      blocks.push({
        dept: currentDept,
        content: currentContent.join("<br>")
      });
    }

    // ✅ HTML 변환 (CSS 기반)
    const formattedDesc = blocks
      .map(
        b => `
        <div class="schedule-item">
          <strong class="schedule-dept">[${b.dept}]</strong><br>
          <div class="schedule-content">${b.content}</div>
        </div>`
      )
      .join("");

    // ✅ 모달 HTML 구성
    const html = `
      <table class="duty-table schedule-table">
        <tbody>
          <tr>
            <td class="schedule-wrapper">${formattedDesc}</td>
          </tr>
        </tbody>
      </table>
    `;

    document.getElementById("modal-schedule").innerHTML = html;
  } catch (e) {
    console.error("오늘일정 불러오기 실패:", e);
    document.getElementById("modal-schedule").innerHTML =
      "<p style='color:var(--warning);text-align:center;'>불러오기에 실패했습니다.</p>";
  }
}

scheduleBtn.addEventListener("click", () => {
  scheduleModal.style.display = "flex";
  loadSchedule(); // 클릭 시 최신 데이터 불러오기
});

closeScheduleBtn.addEventListener("click", () => {
  scheduleModal.style.display = "none";
});

// 배경 클릭 시 닫기
window.addEventListener("click", (e) => {
  if (e.target === scheduleModal) {
    scheduleModal.style.display = "none";
  }
});

// // 메모 카드
// const memoArea = document.getElementById("memoArea");

// // 저장된 메모 불러오기
// memoArea.value = localStorage.getItem("eduinfo.memo") || "";

// // 입력할 때마다 저장
// memoArea.addEventListener("input", () => {
//     localStorage.setItem("eduinfo.memo", memoArea.value);
// });

const MEMO_KEY = "eduinfo.memoCard";
let memos = JSON.parse(localStorage.getItem(MEMO_KEY) || "[]");
let editingIndex = null; // 현재 수정 중인 메모 인덱스

const memoListEl = document.getElementById("memoList");
const addMemoBtn = document.getElementById("addMemoBtn");

const modal = document.getElementById("memoModal");
const closeModal = document.getElementById("closeMemoModal");
const saveMemoBtn = document.getElementById("saveMemoBtn");
const memoTitleInput = document.getElementById("memoTitle");
const memoContentInput = document.getElementById("memoContent");

// 렌더링
function renderMemos() {
  memoListEl.innerHTML = "";
  memos.forEach((memo, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = memo.title;
    btn.onclick = () => openModal(idx); // 클릭하면 수정 모드
    memoListEl.appendChild(btn);
  });
}
renderMemos();

// 모달 열기 (새 메모 or 수정)
function openModal(index = null) {
  editingIndex = index;
  if (index === null) {
    // 새 메모
    memoTitleInput.value = "";
    memoContentInput.value = "";
  } else {
    // 기존 메모 수정
    memoTitleInput.value = memos[index].title;
    memoContentInput.value = memos[index].content;
  }
  modal.style.display = "flex";
}

// 모달 닫기
// closeModal.onclick = () => {
//   modal.style.display = "none";
//   editingIndex = null;
// };

window.addEventListener("click", (e) => {
    if (e.target === closeModal) {
        modal.style.display = "none";
        editingIndex = null;
    }
});



// 저장
saveMemoBtn.onclick = () => {
  const title = memoTitleInput.value.trim();
  const content = memoContentInput.value.trim();
  if (!title || !content) {
    alert("제목과 내용을 입력하세요.");
    return;
  }

  if (editingIndex === null) {
    if (memos.length >= 5) {
      alert("메모는 최대 5개까지만 저장할 수 있습니다.");
      return;
    }
    memos.push({ title, content });
  } else {
    memos[editingIndex] = { title, content };
  }

  localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
  renderMemos();
  modal.style.display = "none";
  editingIndex = null;
};

// 추가 버튼
addMemoBtn.onclick = () => openModal(null);

const deleteMemoBtn = document.getElementById("deleteMemoBtn");

// 모달 열기 (새 메모 or 수정)
function openModal(index = null) {
  editingIndex = index;
  if (index === null) {
    // 새 메모
    memoTitleInput.value = "";
    memoContentInput.value = "";
    deleteMemoBtn.style.display = "none"; // 새 메모일 땐 삭제 숨김
  } else {
    // 기존 메모 수정
    memoTitleInput.value = memos[index].title;
    memoContentInput.value = memos[index].content;
    saveMemoBtn.textContent = "수정"; 
    deleteMemoBtn.style.display = "inline-block"; // 수정 모드일 땐 삭제 보이기
  }
  modal.style.display = "flex";
}

// 삭제 버튼 클릭
deleteMemoBtn.onclick = () => {
  if (editingIndex !== null) {
    if (confirm("이 메모를 삭제하시겠습니까?")) {
      memos.splice(editingIndex, 1); // 해당 인덱스 삭제
      localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
      renderMemos();
      modal.style.display = "none";
      editingIndex = null;
    }
  }
};


// 카드 숨김 및 복원 기능
// 카드 key → 제목 매핑
function buildCardMap() {
  const map = {};
  document.querySelectorAll("#grid .card").forEach(c => {
    const key = c.dataset.key;
    const title = c.querySelector("h3")?.textContent.trim() || "제목 없음";
    map[key] = title;
  });
  return map;
}

// let hiddenCards = JSON.parse(localStorage.getItem("eduinfo.hiddenCards") || "[]");

function hideCard(key) {
  const card = document.querySelector(`#grid .card[data-key="${key}"]`);
  if (!card) return;
  card.style.display = "none";

  if (!hiddenCards.includes(key)) {
    hiddenCards.push(key);
    localStorage.setItem("eduinfo.hiddenCards", JSON.stringify(hiddenCards));
  }
  renderHiddenList();
}

function showCard(key) {
  const card = document.querySelector(`#grid .card[data-key="${key}"]`);
  if (!card) return;
  card.style.display = "";

  hiddenCards = hiddenCards.filter(k => k !== key);
  localStorage.setItem("eduinfo.hiddenCards", JSON.stringify(hiddenCards));
  renderHiddenList();
}

function renderHiddenList() {
  const container = document.getElementById("hiddenList");
  container.innerHTML = "";

  const cardMap = buildCardMap();

  if (hiddenCards.length === 0) {
    container.textContent = "숨긴 카드 없음";
    return;
  }

  hiddenCards.forEach(key => {
    const btn = document.createElement("button");
    btn.textContent = `복원: ${cardMap[key] || key}`;
    btn.onclick = () => showCard(key);
    container.appendChild(btn);
  });
}


// 숨김 카드 목록 토글
document.getElementById("hiddenListBtn").addEventListener("click", () => {
  const list = document.getElementById("hiddenList");
  list.style.display = (list.style.display === "block") ? "none" : "block";
});

// 초기 로딩 시 숨김 적용
window.addEventListener("DOMContentLoaded", () => {
  const hidden = JSON.parse(localStorage.getItem("eduinfo.hiddenCards") || "[]");
  hidden.forEach(key => {
    const el = document.querySelector(`.card[data-key="${key}"]`);
    if (el) el.style.display = "none";
  });
  renderHiddenList();
});
