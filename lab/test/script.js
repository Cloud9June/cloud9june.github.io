import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDoc, getDocs, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEKQSLrBp1rtwpJCu6dqrFv24Lf43hJ4s",
    authDomain: "com-lab-d1d2f.firebaseapp.com",
    projectId: "com-lab-d1d2f",
    storageBucket: "com-lab-d1d2f.firebasestorage.app",
    messagingSenderId: "914308651372",
    appId: "1:914308651372:web:2107a6851de180c46dbb49"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let isCurrentUserAdmin = false;
let currentLabId = null;

const dashboardView = document.getElementById("dashboard-view");
const labView = document.getElementById("lab-view");
const homeBtn = document.getElementById("home-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const labListEl = document.getElementById("lab-list");

// --- 인증 로직 ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const adminDocRef = doc(db, "settings", "admin_list");
        const adminDocSnap = await getDoc(adminDocRef);
        isCurrentUserAdmin = adminDocSnap.exists() && adminDocSnap.data().emails?.includes(user.email);
        userInfo.innerText = isCurrentUserAdmin ? `관리자: ${user.displayName}` : `손님: ${user.displayName}`;
        userInfo.style.color = isCurrentUserAdmin ? "#00d26a" : "#ccc";
        loginBtn.style.display = "none";
        logoutBtn.style.display = "block";
    } else {
        isCurrentUserAdmin = false;
        userInfo.innerText = "로그인이 필요합니다 (보기 전용)";
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
    }
    loadDashboardData();
});

loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
logoutBtn.onclick = () => signOut(auth).then(() => location.reload());

// --- 실습실 목록 ---
const labs = [
    { id: "lab_01", name: "컴퓨터 1실", rows: 5, cols: 6 },
    { id: "lab_02", name: "컴퓨터 2실", rows: 8, cols: 6 },
    { id: "lab_03", name: "컴퓨터 3실", rows: 5, cols: 6 },
    { id: "lab_04", name: "컴퓨터 4실", rows: 5, cols: 6 },
    { id: "lab_05", name: "컴퓨터 5실", rows: 5, cols: 6 },
    { id: "lab_06", name: "컴퓨터 6실", rows: 5, cols: 6 },
    { id: "lab_07", name: "컴퓨터 7실", rows: 5, cols: 6 },
    { id: "lab_08", name: "컴퓨터 8실", rows: 5, cols: 6 },
    { id: "lab_09", name: "컴퓨터 9실", rows: 5, cols: 6 },
    { id: "lab_10", name: "컴퓨터 10실", rows: 5, cols: 6 },
    { id: "lab_11", name: "컴퓨터 11실", rows: 5, cols: 6 },
    { id: "lab_12", name: "컴퓨터 12실", rows: 5, cols: 6 },
    { id: "lab_13", name: "컴퓨터 13실", rows: 5, cols: 6 },
    { id: "lab_14", name: "컴퓨터 14실", rows: 5, cols: 6 },
    { id: "lab_15", name: "미디어실습실", rows: 5, cols: 6 },
    { id: "lab_multi", name: "멀티미디어실", rows: 5, cols: 6 },
];

// 사이드바 메뉴 생성
labs.forEach(lab => {
    const li = document.createElement("li");
    li.innerText = lab.name;
    li.onclick = () => {
        document.querySelectorAll("#lab-list li").forEach(el => el.classList.remove("active"));
        li.classList.add("active");
        loadLab(lab);
    };
    labListEl.appendChild(li);
});

homeBtn.onclick = () => {
    dashboardView.style.display = "flex";
    labView.style.display = "none";
    document.querySelectorAll("#lab-list li").forEach(el => el.classList.remove("active"));
    loadDashboardData();
};

// --- 핵심: 실습실 상세 로드 ---
function loadLab(lab) {
    currentLabId = lab.id;
    dashboardView.style.display = "none";
    labView.style.display = "block";
    document.getElementById("current-lab-title").innerText = lab.name;

    // 실습실 정보 실시간 감시
    onSnapshot(doc(db, "labs", lab.id), (docSnapshot) => {
        const data = docSnapshot.exists() ? docSnapshot.data() : {};
        document.getElementById("current-lab-desc").innerText = data.description || "";
        
        document.getElementById("extra-regular").innerText = data.regularClasses || "입력 필요";
        document.getElementById("extra-after").innerText = data.afterSchool || "입력 필요";
        document.getElementById("extra-sw").innerText = data.software || "입력 필요";

        // 관리자 수정 이벤트
        document.getElementById("edit-info-btn").onclick = () => updateField(lab.id, "description", "실습실 설명");
        document.getElementById("edit-regular").onclick = () => updateField(lab.id, "regularClasses", "정규 수업");
        document.getElementById("edit-after").onclick = () => updateField(lab.id, "afterSchool", "방과후 수업");
        document.getElementById("edit-sw").onclick = () => updateField(lab.id, "software", "설치 소프트웨어");

        renderTimeSlots(lab.id, data.timeSlots || {});
    });

    renderSeatGrid(lab);
}

async function updateField(labId, field, label) {
    if (!isCurrentUserAdmin) return alert("관리자 권한이 필요합니다.");
    const currentVal = document.getElementById(`extra-${field === 'regularClasses' ? 'regular' : field === 'afterSchool' ? 'after' : field === 'software' ? 'sw' : ''}`)?.innerText || "";
    const newVal = prompt(`${label} 정보를 입력하세요:`, field === 'description' ? document.getElementById("current-lab-desc").innerText : currentVal);
    if (newVal !== null) await setDoc(doc(db, "labs", labId), { [field]: newVal }, { merge: true });
}

function renderTimeSlots(labId, slots) {
    const container = document.querySelector(".time-slot-container");
    container.innerHTML = "";
    for (let i = 1; i <= 4; i++) {
        const div = document.createElement("div");
        div.className = "time-slot";
        div.innerHTML = `<span class="slot-label">${i}시점</span><div class="slot-desc">${slots[i] || "미정"}</div>`;
        div.onclick = async () => {
            if (!isCurrentUserAdmin) return alert("관리자 권한이 필요합니다.");
            const text = prompt(`${i}시점 수업명을 입력하세요:`, slots[i] || "");
            if (text !== null) {
                const newSlots = { ...slots, [i]: text };
                await setDoc(doc(db, "labs", labId), { timeSlots: newSlots }, { merge: true });
            }
        };
        container.appendChild(div);
    }
}

// --- 좌석 그리드 렌더링 ---
function renderSeatGrid(lab) {
    const grid = document.getElementById("seat-grid");
    grid.style.gridTemplateColumns = `repeat(${lab.cols}, 1fr)`;
    
    onSnapshot(collection(db, `labs/${lab.id}/seats`), (snapshot) => {
        grid.innerHTML = "";
        let seats = [];
        snapshot.forEach(doc => seats.push({ docId: doc.id, ...doc.data() }));
        seats.sort((a, b) => a.id - b.id);

        if (seats.length === 0) {
            initSeats(lab);
            return;
        }

        let displayNum = 1;
        seats.forEach(seat => {
            const div = document.createElement("div");
            if (seat.isHidden) {
                div.className = "seat hidden-seat";
                div.onclick = () => isCurrentUserAdmin && openModal(seat);
            } else {
                div.className = `seat ${seat.status === 'normal' ? 'normal' : 'error'}`;
                div.innerHTML = `<div class="indicator"></div><div class="seat-num">${displayNum}번</div><div class="issue-text">${seat.issue || "정상"}</div>`;
                const currentNum = displayNum;
                div.onclick = () => isCurrentUserAdmin ? openModal(seat, currentNum) : alert("관리자만 상태를 변경할 수 있습니다.");
                displayNum++;
            }
            grid.appendChild(div);
        });
    });
}

async function initSeats(lab) {
    for (let i = 1; i <= lab.rows * lab.cols; i++) {
        await setDoc(doc(db, `labs/${lab.id}/seats`, `pos_${i}`), { id: i, status: "normal", isHidden: false, issue: "" });
    }
}

// --- 모달 관련 ---
const modal = document.getElementById("modal");
const issueSelect = document.getElementById("issue-select");
let selectedSeat = null;

function openModal(seat, num) {
    selectedSeat = seat;
    document.getElementById("selected-seat-num").innerText = num || "?";
    issueSelect.innerHTML = `
        <option value="normal">✅ 정상</option>
        <option value="booting">❌ 부팅 안됨</option>
        <option value="power">🔌 전원 고장</option>
        <option value="monitor">🖥️ 모니터 고장</option>
        <option value="keyboard">⌨️ 키보드/마우스 고장</option>
        <option value="network">🌐 네트워크 오류</option>
        <option value="hidden">❌ 이 자리 비우기</option>
        ${seat.isHidden ? '<option value="restore">✅ 다시 좌석으로 사용</option>' : ''}
    `;
    modal.classList.remove("hidden");
}

document.getElementById("cancel-btn").onclick = () => modal.classList.add("hidden");
document.getElementById("save-btn").onclick = async () => {
    const val = issueSelect.value;
    const ref = doc(db, `labs/${currentLabId}/seats`, selectedSeat.docId);
    if (val === "hidden") await setDoc(ref, { isHidden: true }, { merge: true });
    else if (val === "restore") await setDoc(ref, { isHidden: false, status: "normal", issue: "" }, { merge: true });
    else {
        const isNormal = val === "normal";
        await setDoc(ref, { isHidden: false, status: isNormal ? "normal" : "error", issue: isNormal ? "" : issueSelect.options[issueSelect.selectedIndex].text }, { merge: true });
    }
    modal.classList.add("hidden");
};

// --- 대시보드 데이터 로드 ---
async function loadDashboardData() {
    const listEl = document.getElementById("lab-status-list");
    let html = "";
    for (const lab of labs) {
        const snap = await getDocs(collection(db, `labs/${lab.id}/seats`));
        let total = 0, avail = 0, err = 0, errList = [];
        snap.forEach(doc => {
            const s = doc.data();
            if (!s.isHidden) {
                total++;
                if (s.status === "normal") avail++;
                else { err++; errList.push(s.id); }
            }
        });
        html += `
            <li class="status-item">
                <div class="col-name"><b>${lab.name}</b></div>
                <div class="col-stat">${total}석</div>
                <div class="col-stat" style="color:#00b359">${avail}</div>
                <div class="col-stat" style="color:${err > 0 ? '#ff385c' : '#ccc'}">${err}</div>
                <div class="col-list">${errList.sort((a,b)=>a-b).join(", ") || "-"}</div>
            </li>
        `;
    }
    listEl.innerHTML = html;
}