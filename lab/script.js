import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDoc, getDocs, doc, setDoc, onSnapshot } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
let isCurrentUserAdmin = false; // 현재 로그인한 사람이 관리자인지 기억
const dashboardView = document.getElementById("dashboard-view");
const labView = document.getElementById("lab-view");
const homeBtn = document.getElementById("home-btn");

// ==========================================================
// 🔑 로그인/로그아웃 버튼 기능 (여기가 빠져있어서 추가했습니다!)
// ==========================================================
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");

// 1. 로그인 버튼 클릭 시 실행
loginBtn.onclick = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("로그인 성공:", result.user.email);
        })
        .catch((error) => {
            console.error("로그인 에러:", error);
            alert("로그인 실패: " + error.message);
        });
};

// 2. 로그아웃 버튼 클릭 시 실행
logoutBtn.onclick = () => {
    signOut(auth)
        .then(() => {
            alert("로그아웃 되었습니다.");
            location.reload(); // 깔끔하게 새로고침
        });
};

// ==========================================================
// 🔐 로그인 상태 감지 및 관리자 확인
// ==========================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인 성공 시
        try {
            const adminDocRef = doc(db, "settings", "admin_list");
            const adminDocSnap = await getDoc(adminDocRef);
            
            if (adminDocSnap.exists()) {
                const adminEmails = adminDocSnap.data().emails || [];
                
                // 내 이메일이 관리자 목록에 있는지 확인
                if (adminEmails.includes(user.email)) {
                    isCurrentUserAdmin = true;
                    userInfo.innerText = `관리자: ${user.displayName}`;
                    userInfo.style.color = "#00d26a"; // 초록색
                } else {
                    isCurrentUserAdmin = false;
                    userInfo.innerText = `손님(학생): ${user.displayName}`;
                    userInfo.style.color = "#ccc";
                }
            } else {
                console.warn("관리자 명단(settings/admin_list)이 DB에 없습니다.");
                isCurrentUserAdmin = false;
                userInfo.innerText = `손님: ${user.displayName}`;
            }
        } catch (error) {
            console.error("관리자 확인 중 오류 (권한 부족 등):", error);
            isCurrentUserAdmin = false;
            userInfo.innerText = `손님: ${user.displayName}`;
        }

        loginBtn.style.display = "none";
        logoutBtn.style.display = "block";
    } else {
        // 로그아웃 상태일 때
        isCurrentUserAdmin = false;
        userInfo.innerText = "로그인이 필요합니다 (보기 전용)";
        userInfo.style.color = "#ccc";
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
    }
});

// ==========================================================
// 🏫 실습실 데이터 및 로직
// ==========================================================
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

let currentLabId = null;
let currentDocId = null; 

const labListEl = document.getElementById("lab-list");
const seatGridEl = document.getElementById("seat-grid");
const titleEl = document.getElementById("current-lab-title");
const modal = document.getElementById("modal");
const modalTitle = document.querySelector(".modal-content h3");
const descEl = document.getElementById("current-lab-desc");
const editInfoBtn = document.getElementById("edit-info-btn");

// 사이드바 생성
labs.forEach(lab => {
    const li = document.createElement("li");
    li.innerText = lab.name;
    li.onclick = () => {
        const allListItems = document.querySelectorAll("#lab-list li");
        allListItems.forEach(item => item.classList.remove("active"));
        li.classList.add("active");
        loadLab(lab);
    };
    labListEl.appendChild(li);
});

loadDashboardData();

// ==========================================================
// 🏠 [추가] 제목 클릭 시 초기 화면(대시보드)으로 복귀
// ==========================================================
if (homeBtn) {
    homeBtn.onclick = () => {
        // 1. 화면 전환 (대시보드 보이기, 실습실 숨기기)
        if (dashboardView && labView) {
            dashboardView.style.display = "flex"; // CSS의 flex 속성 유지
            labView.style.display = "none";
        }

        // 2. 사이드바 선택 표시 해제 (회색 하이라이트 제거)
        const allListItems = document.querySelectorAll("#lab-list li");
        allListItems.forEach(item => item.classList.remove("active"));

        // 3. 내부 상태 초기화 (선택된 실습실 없음)
        currentLabId = null;

        loadDashboardData();
    };
}

function loadLab(lab) {
    if (dashboardView && labView) {
        dashboardView.style.display = "none";  // 대시보드 숨김
        labView.style.display = "block";       // 실습실 화면 보임
    }

    currentLabId = lab.id;
    titleEl.innerText = lab.name;
    descEl.innerText = ""; 

    // 설명 수정 버튼 이벤트 (관리자 체크 추가)
    editInfoBtn.onclick = async () => {
        if (!isCurrentUserAdmin) return alert("관리자만 수정할 수 있습니다."); // 🚫 권한 체크
        const newDesc = prompt("실습실에 대한 설명을 입력하세요:", descEl.innerText);
        if (newDesc !== null) {
            await setDoc(doc(db, "labs", lab.id), { description: newDesc }, { merge: true });
        }
    };

    const timeSlotContainer = document.querySelector(".time-slot-container");

    // 1. 실습실 설명 & 시점 정보
    onSnapshot(doc(db, "labs", lab.id), (docSnapshot) => {
        const data = docSnapshot.exists() ? docSnapshot.data() : {};
        descEl.innerText = data.description || "";

        timeSlotContainer.innerHTML = ""; 
        const slots = data.timeSlots || {};

        for (let i = 1; i <= 4; i++) {
            const slotText = slots[i] || "클릭하여 입력"; 
            const isEmpty = !slots[i]; 

            const slotDiv = document.createElement("div");
            slotDiv.className = "time-slot";
            slotDiv.innerHTML = `
                <span class="slot-label">${i}시점</span>
                <div class="slot-desc ${isEmpty ? 'empty' : ''}">${slotText}</div>
            `;

            // ✨ 시점 정보 수정 (관리자 체크 추가)
            slotDiv.onclick = async () => {
                if (!isCurrentUserAdmin) return alert("관리자만 수정할 수 있습니다."); // 🚫 권한 체크
                const newText = prompt(`${i}시점의 용도를 입력하세요:`, slots[i] || "");
                if (newText !== null) {
                    const updatedSlots = { ...slots }; 
                    updatedSlots[i] = newText;
                    await setDoc(doc(db, "labs", lab.id), { timeSlots: updatedSlots }, { merge: true });
                }
            };
            timeSlotContainer.appendChild(slotDiv);
        }
    });

    // 2. 수리 중 체크
    if (lab.rows === 0 && lab.cols === 0) {
        seatGridEl.style.display = "block"; 
        seatGridEl.innerHTML = `
            <div class="maintenance-box">
                <span class="maintenance-icon">🚧</span>
                <h3>실습실 전체 수리 중</h3>
                <p>현재 이 실습실은 이용하실 수 없습니다.<br>관리자에게 문의해주세요.</p>
            </div>
        `;
        return; 
    }

    // 3. 좌석 로딩
    seatGridEl.style.display = "grid"; 
    seatGridEl.style.gridTemplateColumns = `repeat(${lab.cols}, 1fr)`;

    onSnapshot(collection(db, `labs/${lab.id}/seats`), (snapshot) => {
        seatGridEl.innerHTML = "";
        
        const seatsData = [];
        snapshot.forEach(doc => seatsData.push(doc.data()));
        seatsData.sort((a, b) => a.id - b.id);

        const totalNeeded = lab.rows * lab.cols;
        const currentCount = seatsData.length;

        if (currentCount === 0) {
            initLabData(lab);
            return;
        }
        if (currentCount < totalNeeded) {
            addMissingSeats(lab, currentCount + 1, totalNeeded);
            return;
        }

        let displayCounter = 1; 

        seatsData.forEach(seat => {
            if (seat.id > totalNeeded) return;

            const seatDiv = document.createElement("div");
            
            if (seat.isHidden) {
                seatDiv.className = "seat hidden-seat";
                // 빈 공간 클릭 (관리자 체크 추가)
                seatDiv.onclick = () => {
                    if (!isCurrentUserAdmin) return alert("관리자만 수정할 수 있습니다.");
                    openModal(seat, 0); 
                };
            } else {
                seatDiv.className = `seat ${seat.status === 'normal' ? 'normal' : 'error'}`;
                seatDiv.innerHTML = `
                    <div class="indicator"></div>
                    <div class="seat-num">${displayCounter}번</div>
                    <div class="issue-text">${seat.issue || "정상"}</div>
                `;
                const currentNum = displayCounter;
                // 정상 좌석 클릭 (관리자 체크 추가)
                seatDiv.onclick = () => {
                    if (!isCurrentUserAdmin) return alert("관리자만 상태를 변경할 수 있습니다.");
                    openModal(seat, currentNum);
                };
                displayCounter++;
            }
            seatGridEl.appendChild(seatDiv);
        });
    });
}

// 부족한 좌석 추가
async function addMissingSeats(lab, startNum, endNum) {
    for (let i = startNum; i <= endNum; i++) {
        await setDoc(doc(db, `labs/${lab.id}/seats`, `pos_${i}`), {
            id: i, isHidden: false, status: "normal", issue: ""
        });
    }
}

// 초기 데이터 생성
async function initLabData(lab) {
    const totalSlots = lab.rows * lab.cols;
    for (let i = 1; i <= totalSlots; i++) {
        await setDoc(doc(db, `labs/${lab.id}/seats`, `pos_${i}`), {
            id: i, isHidden: false, status: "normal", issue: ""
        });
    }
}

// 모달 관련
const issueSelect = document.getElementById("issue-select");

const hiddenOption = document.createElement("option");
hiddenOption.value = "hidden";
hiddenOption.innerText = "❌ 이 자리를 비우기 (건너뛰기)";
hiddenOption.style.color = "red";
issueSelect.appendChild(hiddenOption);

const restoreOption = document.createElement("option");
restoreOption.value = "restore";
restoreOption.innerText = "✅ 다시 좌석으로 사용";
restoreOption.style.color = "green";

function openModal(seatData, displayNum) {
    currentDocId = seatData.id; 
    modal.classList.remove("hidden");
    
    if (seatData.isHidden) {
        modalTitle.innerText = "빈 공간 설정";
        issueSelect.innerHTML = ""; 
        issueSelect.appendChild(restoreOption); 
    } else {
        modalTitle.innerText = `좌석 상태 변경 (${displayNum}번)`;
        issueSelect.innerHTML = `
            <option value="normal">✅ 정상 (수리완료)</option>
            <option value="booting">❌ 부팅 안됨</option>
            <option value="power">🔌 전원 안 켜짐</option>
            <option value="hardware">🖥️ 모니터 고장/파손</option>
            <option value="network">🌐 인터넷/네트워크 오류</option>
            <option value="sw">💾 프로그램 없음/오류</option>
            <option value="hardware">⌨️ 키보드/마우스 고장</option>
            <option value="etc">기타</option>
        `;
        issueSelect.appendChild(hiddenOption); 
    }
}

document.getElementById("cancel-btn").onclick = () => {
    modal.classList.add("hidden");
};

document.getElementById("save-btn").onclick = async () => {
    const issueValue = issueSelect.value;
    const issueText = issueSelect.options[issueSelect.selectedIndex].text;
    const docRef = doc(db, `labs/${currentLabId}/seats`, `pos_${currentDocId}`);

    if (issueValue === "hidden") {
        await setDoc(docRef, { id: currentDocId, isHidden: true, status: "normal", issue: "" });
    } else if (issueValue === "restore") {
        await setDoc(docRef, { id: currentDocId, isHidden: false, status: "normal", issue: "" });
    } else {
        const newStatus = issueValue === "normal" ? "normal" : "error";
        const newIssueText = issueValue === "normal" ? "" : issueText;
        await setDoc(docRef, { id: currentDocId, isHidden: false, status: newStatus, issue: newIssueText });
    }
    modal.classList.add("hidden");
};

async function loadDashboardData() {
    const listEl = document.getElementById("lab-status-list");
    if (!listEl) return;

    listEl.innerHTML = '<li class="loading-msg">전체 실습실 현황을 불러오는 중입니다... ⏳</li>';

    let html = "";

    // labs 배열에 있는 모든 실습실을 하나씩 조회
    for (const lab of labs) {
        // 1. 수리 중인 실습실 (rows=0) 처리
        if (lab.rows === 0 && lab.cols === 0) {
            html += `
                <li class="status-item" style="background: #fff8e1;">
                    <div class="col-name"><b>${lab.name}</b></div>
                    <div class="col-stat" colspan="4" style="color: #f1c40f; font-weight:bold; grid-column: 2 / 6;">
                        🚧 전체 리모델링 / 공사 중
                    </div>
                </li>
            `;
            continue; // 다음 실습실로 넘어감
        }

        // 2. 정상 실습실 데이터 가져오기
        // (주의: 실시간 onSnapshot 대신 getDocs를 써서 한 번만 로딩합니다. 성능 최적화)
        const querySnapshot = await getDocs(collection(db, `labs/${lab.id}/seats`));
        
        let totalRealSeats = 0; // 실제 좌석 (빈공간 제외)
        let availableCount = 0; // 사용 가능 (status: normal)
        let errorCount = 0;     // 사용 불가
        let errorList = [];     // 고장난 좌석 번호들

        querySnapshot.forEach((doc) => {
            const seat = doc.data();
            
            // 빈 공간(isHidden)은 전체 좌석 수에서도 뺍니다.
            if (seat.isHidden) return; 

            totalRealSeats++;

            if (seat.status === "normal") {
                availableCount++;
            } else {
                errorCount++;
                // 1~9번은 01, 02 처럼 보이면 예쁨 (선택사항)
                errorList.push(seat.id); 
            }
        });

        // 고장 번호 정렬 (오름차순)
        errorList.sort((a, b) => a - b);
        const errorText = errorList.length > 0 ? errorList.join(", ") + "번" : "-";

        // HTML 한 줄 추가
        html += `
            <li class="status-item">
                <div class="col-name"><b>${lab.name}</b></div>
                <div class="col-stat">${totalRealSeats}석</div>
                <div class="col-stat" style="color:#00b359; font-weight:bold;">${availableCount}</div>
                <div class="col-stat" style="color:${errorCount > 0 ? '#cc0000' : '#ccc'}; font-weight:bold;">
                    ${errorCount}
                </div>
                <div class="col-list">${errorText}</div>
            </li>
        `;
    }

    listEl.innerHTML = html;
}