import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ✅ Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCLqk1QR99S7b81SOoGSfFzXwaHXxpCVRI",
  authDomain: "sungil-feedboard.firebaseapp.com",
  projectId: "sungil-feedboard",
  storageBucket: "sungil-feedboard.appspot.com",
  messagingSenderId: "165204329485",
  appId: "1:165204329485:web:08b2e11470f22da9fa4144",
};

// ✅ 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ✅ Cloudinary 설정
const CLOUD_NAME = "dgldvmyu5";
const UPLOAD_PRESET = "unsigned_upload";

// ✅ 요소 참조
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const form = document.getElementById("postForm");
const openPostModal = document.getElementById("openPostModal");
const postModal = document.getElementById("postModal");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const submitBtn = document.getElementById("submitBtn");
const previewImage = document.getElementById("previewImage");
const uploadWidgetBtn = document.getElementById("uploadWidgetBtn");
const deleteImageBtn = document.getElementById("deleteImageBtn");

let uploadedImageUrl = "";
let imageDeleted = false;

// ✅ Quill 구분선(HR) 블롯 등록
const BlockEmbed = Quill.import("blots/block/embed");
class DividerBlot extends BlockEmbed {
  static create() {
    const node = super.create();
    node.setAttribute("class", "ql-divider");
    return node;
  }
}
DividerBlot.blotName = "hr";
DividerBlot.tagName = "hr";
Quill.register(DividerBlot);

// ✅ Quill 에디터 초기화
let quill;
window.addEventListener("DOMContentLoaded", () => {
  const editorContainer = document.getElementById("quillEditor");
  if (editorContainer) {
    quill = new Quill("#quillEditor", {
      theme: "snow",
      placeholder: "내용을 입력하세요...",
      modules: {
        toolbar: {
          container: [
            ["bold", "italic", "underline", "strike"],
            [{ color: [] }, { background: [] }],
            // ["blockquote", "code-block"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link"],
            ["hr"],
          ],
          handlers: {
            // ✅ 구분선 버튼 동작 정의
            hr: function () {
              const range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, "hr", true, Quill.sources.USER);
              this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
            },
          },
        },
      },
    });
    const hrButton = document.querySelector(".ql-hr");
    if (hrButton) {
      hrButton.innerHTML = "_"; // 수평선 느낌 아이콘
      // hrButton.title = "구분선 넣기";
      hrButton.style.fontSize = "16px";
      hrButton.style.fontWeight = "700";
      hrButton.style.color = "#333";
      hrButton.style.minWidth = "28px";
      hrButton.style.textAlign = "center";
      hrButton.style.opacity = "1";
      hrButton.style.transition = "background 0.2s";
      hrButton.style.cursor = "pointer";
    }
  }
});


// ✅ Cropper.js 기반 이미지 선택 + 크롭
if (uploadWidgetBtn) {
  uploadWidgetBtn.addEventListener("click", async () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const cropModal = document.createElement("div");
        cropModal.classList.add("crop-modal");
        cropModal.innerHTML = `
          <div class="crop-box">
            <img id="cropImage" src="${reader.result}" alt="crop image">
            <div class="crop-actions">
              <button id="cropConfirmBtn">자르기 완료</button>
              <button id="cropCancelBtn">취소</button>
            </div>
          </div>
        `;
        document.body.appendChild(cropModal);

        const image = document.getElementById("cropImage");
        const cropper = new Cropper(image, {
          aspectRatio: 5 / 2,
          viewMode: 1,
          autoCropArea: 1,
          responsive: true,
          background: false,
        });

        document.getElementById("cropConfirmBtn").onclick = async () => {
          const canvas = cropper.getCroppedCanvas({ width: 1000, height: 400 });
          const blob = await new Promise((res) =>
            canvas.toBlob(res, "image/jpeg")
          );
          await uploadToCloudinary(blob);
          cropper.destroy();
          cropModal.remove();
        };

        document.getElementById("cropCancelBtn").onclick = () => {
          cropper.destroy();
          cropModal.remove();
        };
      };
      reader.readAsDataURL(file);
    };

    fileInput.click();
  });
}

// ✅ Cloudinary 업로드 함수
async function uploadToCloudinary(blob) {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  const data = await res.json();

  uploadedImageUrl = data.secure_url;
  previewImage.src = uploadedImageUrl;
  previewImage.style.display = "block";
  deleteImageBtn.style.display = "inline-block";
  imageDeleted = false;
}

// ✅ 이미지 삭제
if (deleteImageBtn) {
  deleteImageBtn.addEventListener("click", () => {
    if (confirm("이미지를 삭제하시겠습니까?")) {
      uploadedImageUrl = "";
      previewImage.src = "";
      previewImage.style.display = "none";
      deleteImageBtn.style.display = "none";
      imageDeleted = true;
    }
  });
}

// ✅ 로그인/로그아웃
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email || "";
    const domain = email.split("@")[1] || "";

    // 🚫 학교 계정 외 로그인 차단
    if (domain !== "sungil-i.kr") {
      alert("학교 계정(@sungil-i.kr)으로만 로그인할 수 있습니다.\n학교 계정으로 다시 시도해주세요.");
      await signOut(auth); // 로그인 즉시 강제 로그아웃
      return;
    }

    // ✅ 학교 계정이면 그대로 진행 → onAuthStateChanged가 UI 처리함
    location.reload();

  } catch (e) {
    alert("로그인 실패: " + e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

// ✅ 로그인 상태 감시 (업데이트 버전)
onAuthStateChanged(auth, async (user) => {
  const deptSelect = document.getElementById("deptSelect");

  if (user) {
    const email = user.email || "";
    const domain = email.split("@")[1] || "";

    // 🚫 외부 계정 차단
    if (domain !== "sungil-i.kr") {
      alert("학교 계정(@sungil-i.kr)으로만 로그인할 수 있습니다.");
      await signOut(auth);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // ✅ Firestore에 사용자 정보 없으면 자동 등록 (viewer 기본권한)
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "이름 없음",
        email: user.email,
        role: "viewer",
        createdAt: serverTimestamp(),
      });
      alert(
        "학교 계정으로 최초 로그인되었습니다.\n현재는 '열람 전용(viewer)' 상태이며, 관리자가 권한을 부여하면 글쓰기가 가능합니다."
      );
    }

    // ✅ Firestore에서 role 확인
    const updatedSnap = await getDoc(userRef);
    const role = updatedSnap.exists() ? updatedSnap.data().role : "viewer";

    // ✅ UI 표시 제어 (기존 로직 유지 + role 반영)
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    if (role === "viewer") {
      openPostModal.style.display = "none"; // 글쓰기 버튼 비활성화
    } else {
      openPostModal.style.display = "inline-block"; // teacher, admin 가능
    }

  } else {
    // 🚪 로그아웃 상태
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    openPostModal.style.display = "none";
    postModal.style.display = "none";
    deptSelect.style.display = "none";
  }

  // ✅ 반응형 학과 선택 셀렉트박스 표시 제어 (기존 유지)
  function updateDeptSelectVisibility() {
    const deptSelect = document.getElementById("deptSelect");
    if (!deptSelect) return;

    if (window.innerWidth <= 1600) {
      deptSelect.style.display = "block";  // 모바일 화면이면 표시
    } else {
      deptSelect.style.display = "none";   // PC 화면이면 숨김
    }
  }

  updateDeptSelectVisibility();
  window.addEventListener("resize", updateDeptSelectVisibility);
});


// ✅ 화면 크기 변경 시 처리
window.addEventListener("resize", () => {
  const deptSelect = document.getElementById("deptSelect");
  if (!deptSelect) return;

  const user = auth.currentUser;
  if (user) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      deptSelect.style.display = "block";
    } else {
      deptSelect.style.display = "none";
    }
  }
});

// ✅ 글쓰기 모달 열기
openPostModal.addEventListener("click", () => {
  modalTitle.textContent = "게시글 작성";
  submitBtn.textContent = "등록";
  form.reset();
  quill.root.innerHTML = ""; // ✅ 에디터 초기화
  uploadedImageUrl = "";
  previewImage.src = "";
  previewImage.style.display = "none";
  postModal.style.display = "flex";
});

// ✅ 모달 닫기
closeModal.addEventListener("click", () => {
  postModal.style.display = "none";
});

// ✅ 등록 및 수정
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dept = form.dept.value;
  const title = form.title.value.trim();
  const content = quill.root.innerHTML.trim(); // ✅ Quill 내용
  const user = auth.currentUser;
  const editId = form.dataset.editId || null;

  if (!user) return alert("로그인이 필요합니다.");
  if (!content || content === "<p><br></p>")
    return alert("내용을 입력하세요.");

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<div class="spinner"></div> ${
    editId ? "수정 중..." : "등록 중..."
  }`;

  try {
    if (editId) {
      const docRef = doc(db, "feeds", editId);
      const updateData = { dept, title, content, updatedAt: serverTimestamp() };
      if (!imageDeleted && uploadedImageUrl)
        updateData.imageUrl = uploadedImageUrl;
      if (imageDeleted) updateData.imageUrl = "";
      await updateDoc(docRef, updateData);
      alert("✅ 게시글이 수정되었습니다!");
    } else {
      await addDoc(collection(db, "feeds"), {
        dept,
        title,
        content,
        imageUrl: uploadedImageUrl,
        author: user.displayName ? `${user.displayName} 선생님` : "000 선생님",
        authorUid: user.uid,
        deleted: false,
        createdAt: serverTimestamp(),
      });
      alert("✅ 게시글이 등록되었습니다!");
    }

    form.reset();
    quill.root.innerHTML = ""; // ✅ 에디터 리셋
    delete form.dataset.editId;
    previewImage.style.display = "none";
    postModal.style.display = "none";
  } catch (err) {
    console.error(err);
    alert("⚠️ 오류 발생");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "등록";
  }
});

// ✅ 실시간 피드 (deleted=false 또는 필드 없음만 표시)
let isRendering = false; // 🔹 중복 렌더링 방지용 플래그

const feedRef = collection(db, "feeds");
const q = query(feedRef, orderBy("createdAt", "asc"));

onSnapshot(q, async (snapshot) => {
  if (isRendering) return; // 🚫 이미 렌더링 중이면 중복 방지
  isRendering = true;

  // ✅ 모든 학과 컬럼 초기화
  document.querySelectorAll(".column").forEach((col) => {
    const deptName = col.classList[1];
    col.innerHTML = `<h2>${deptName}</h2>`;
  });

  const currentUser = auth.currentUser;
  let currentRole = "teacher";

  // ✅ 로그인한 사용자 권한(role) 가져오기
  if (currentUser) {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) currentRole = userSnap.data().role || "teacher";
  }

  // ✅ 피드 렌더링
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const section = document.querySelector(`.${data.dept}`);
    if (!section) return;
    if (data.deleted === true) return; // 삭제된 글 숨기기

    const canEditOrDelete =
      (currentUser && data.authorUid === currentUser.uid) ||
      currentRole === "admin";

    section.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card" data-id="${docSnap.id}">
        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="">` : ""}
        <div class="card-content">
          <h3>${data.title}</h3>
          <div class="content">${data.content}</div>
          ${currentUser ? `<div class="author">작성자: ${data.author}</div>` : ""}
          ${
            canEditOrDelete
              ? `<div class="actions">
                   <button class="editBtn">수정</button>
                   <button class="deleteBtn">삭제</button>
                 </div>`
              : ""
          }
        </div>
      </div>`
    );
  });

  // ✏️ 수정 버튼
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".card");
      const id = card.dataset.id;
      const docRef = doc(db, "feeds", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return alert("데이터를 불러올 수 없습니다.");

      const data = docSnap.data();
      const currentUser = auth.currentUser;
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const role = userSnap.exists() ? userSnap.data().role : "teacher";

      if (data.authorUid !== currentUser.uid && role !== "admin")
        return alert("⚠️ 본인 작성 글 또는 관리자만 수정할 수 있습니다.");

      modalTitle.textContent = "게시글 수정";
      submitBtn.textContent = "수정 완료";
      postModal.style.display = "flex";
      form.dept.value = data.dept || "";
      form.title.value = data.title || "";
      quill.root.innerHTML = data.content || ""; // ✅ Quill 내용 반영
      uploadedImageUrl = data.imageUrl || "";
      if (uploadedImageUrl) {
        previewImage.src = uploadedImageUrl;
        previewImage.style.display = "block";
        deleteImageBtn.style.display = "inline-block";
      }
      form.dataset.editId = id;
    });
  });

  // 🗑️ 삭제 버튼
  document.querySelectorAll(".deleteBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".card").dataset.id;
      const docRef = doc(db, "feeds", id);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();

      const currentUser = auth.currentUser;
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const role = userSnap.exists() ? userSnap.data().role : "teacher";

      if (data.authorUid !== currentUser.uid && role !== "admin")
        return alert("⚠️ 본인 작성 글 또는 관리자만 삭제할 수 있습니다.");

      if (confirm("정말 삭제하시겠습니까?")) {
        await updateDoc(docRef, { deleted: true, deletedAt: serverTimestamp() });
        alert("🗑️ 게시글이 비활성화되었습니다.");
      }
    });
  });

  isRendering = false; // ✅ 렌더링 완료 후 해제
});

// ✅ Quill 에디터 전체 클릭 시 포커스 이동
document.addEventListener("click", (e) => {
  const editorContainer = document.querySelector(".ql-container");
  const editor = document.querySelector(".ql-editor");
  if (!editorContainer || !editor) return;

  // 빈 영역 클릭 시 포커스 부여
  if (editorContainer.contains(e.target) && !editor.contains(e.target)) {
    quill.focus();
  }
});

// ✅ 스크롤 시 헤더 투명도 변경
window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  const scrollY = window.scrollY;

  if (scrollY > 20) {
    header.style.background = "rgba(255, 255, 255, 0.2)";
    header.style.backdropFilter = "blur(2px)";
    header.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
  } else {
    header.style.background = "#fff";
    header.style.backdropFilter = "none";
    header.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.05)";
  }
});

// ✅ 맨 위로 버튼 제어
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});


// ✅ 학과 선택 스크롤
const deptSelect = document.getElementById("deptSelect");
if (deptSelect) {
  deptSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) return;
    const targetSection = document.querySelector(`.${value}`);
    if (targetSection) {
      const headerHeight = document.querySelector("header").offsetHeight; // 헤더 높이
      const elementTop = targetSection.getBoundingClientRect().top + window.scrollY;
      
      // ✅ 스무스하게 스크롤하되, 헤더 높이만큼 덜 이동
      window.scrollTo({
        top: elementTop - headerHeight - 10, // 약간 여유 있게 (-10)
        behavior: "smooth",
      });
    }
  });
}

/* main.js 하단에 추가 또는 수정 */

// ✅ 학과 전환 함수 (모바일/PC 공통)
function switchToDept(deptName) {
  const isMobile = window.innerWidth <= 768;
  const targetSection = document.querySelector(`.${deptName}`);
  const mobileMenu = document.getElementById("mobileMenu");

  if (!targetSection) return;

  if (isMobile) {
    // 1. 모바일 메뉴 숨기기
    if (mobileMenu) mobileMenu.style.display = "none";

    // 2. 모든 컬럼 숨기고 선택한 것만 active
    document.querySelectorAll(".column").forEach((col) => {
      col.classList.remove("active");
    });
    targetSection.classList.add("active");

    // 3. 최상단으로 스크롤
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    // 4. 셀렉트 박스 값도 동기화
    if(deptSelect) deptSelect.value = deptName;

  } else {
    // 5. PC 환경: 기존처럼 스크롤만 이동
    const headerHeight = document.querySelector("header").offsetHeight;
    const elementTop = targetSection.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: elementTop - headerHeight - 10,
      behavior: "smooth",
    });
  }
}

// ✅ 1. 모바일 메뉴판 버튼 클릭 이벤트 등록
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const dept = btn.dataset.dept;
    switchToDept(dept);
  });
});

// ✅ 2. 기존 셀렉트박스(deptSelect) 이벤트 수정
if (deptSelect) {
  deptSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      switchToDept(value);
    } else {
      // '학과 선택' 클릭 시 모바일에서는 다시 메뉴판 보여주기
      if (window.innerWidth <= 768) {
        document.getElementById("mobileMenu").style.display = "block";
        document.querySelectorAll(".column").forEach(col => col.classList.remove("active"));
      }
    }
  });
}