import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc
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
          const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg"));
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

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
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
    await signInWithPopup(auth, provider);
    location.reload();
  } catch (e) {
    alert("로그인 실패: " + e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

// ✅ 로그인 상태 감시 (통합 버전)
onAuthStateChanged(auth, async (user) => {
  const deptSelect = document.getElementById("deptSelect");

  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
      openPostModal.style.display = "inline-block";

      // ✅ 모바일 화면일 때만 학과 선택 셀렉트 표시
      if (window.matchMedia("(max-width: 768px)").matches) {
        deptSelect.style.display = "block";
      } else {
        deptSelect.style.display = "none";
      }
    } else {
      alert("🚫 접근 권한이 없습니다.");
      await signOut(auth);
    }
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    openPostModal.style.display = "none";
    postModal.style.display = "none";
    deptSelect.style.display = "none";
  }
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
  const content = form.content.value.trim();
  const user = auth.currentUser;
  const editId = form.dataset.editId || null;

  if (!user) return alert("로그인이 필요합니다.");

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<div class="spinner"></div> ${editId ? "수정 중..." : "등록 중..."}`;

  try {
    if (editId) {
      const docRef = doc(db, "feeds", editId);
      const updateData = { dept, title, content, updatedAt: serverTimestamp() };
      if (!imageDeleted && uploadedImageUrl) updateData.imageUrl = uploadedImageUrl;
      if (imageDeleted) updateData.imageUrl = "";
      await updateDoc(docRef, updateData);
      alert("✅ 게시글이 수정되었습니다!");
    } else {
      await addDoc(collection(db, "feeds"), {
        dept,
        title,
        content,
        imageUrl: uploadedImageUrl,
        author: (user.displayName ? `${user.displayName} 선생님` : "000 선생님"),
        authorUid: user.uid,
        deleted: false, // ✅ 기본값 추가
        createdAt: serverTimestamp(),
      });
      alert("✅ 게시글이 등록되었습니다!");
    }

    form.reset();
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
const feedRef = collection(db, "feeds");
const q = query(feedRef, orderBy("createdAt", "asc"));

onSnapshot(q, async (snapshot) => {
  document.querySelectorAll(".column").forEach((col) => {
    const deptName = col.classList[1];
    col.innerHTML = `<h2>${deptName}</h2>`;
  });

  const currentUser = auth.currentUser;
  let currentRole = "teacher";

  // ✅ 현재 로그인한 유저 role 불러오기
  if (currentUser) {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      currentRole = userSnap.data().role || "teacher";
    }
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const section = document.querySelector(`.${data.dept}`);
    if (!section) return;

    if (data.deleted === true) return; // 삭제된 글 숨기기

    // ✅ 본인 글 or 관리자일 때만 수정/삭제 버튼 보이기
    const canEditOrDelete =
      (currentUser && data.authorUid === currentUser.uid) ||
      currentRole === "admin";

    section.innerHTML += `
      <div class="card" data-id="${docSnap.id}">
        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="">` : ""}
        <div class="card-content">
          <h3>${data.title}</h3>
          <p style="white-space: pre-line;">${data.content}</p>
          <div class="author">작성자: ${data.author}</div>
          ${
            canEditOrDelete
              ? `<div class="actions">
                   <button class="editBtn">수정</button>
                   <button class="deleteBtn">삭제</button>
                 </div>`
              : ""
          }
        </div>
      </div>`;
  });

  // ✏️ 수정 버튼 이벤트
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".card");
      const id = card.dataset.id;
      const docRef = doc(db, "feeds", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return alert("데이터를 불러올 수 없습니다.");

      const data = docSnap.data();

      // ✅ 현재 로그인한 사용자 정보 가져오기
      const currentUser = auth.currentUser;
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const role = userSnap.exists() ? userSnap.data().role : "teacher";

      // ✅ 권한 확인: 관리자 or 본인 글만 수정 가능
      if (data.authorUid !== currentUser.uid && role !== "admin") {
        return alert("⚠️ 본인 작성 글 또는 관리자만 수정할 수 있습니다.");
      }

      // ✅ 수정 모달 열기
      modalTitle.textContent = "게시글 수정";
      submitBtn.textContent = "수정 완료";
      postModal.style.display = "flex";
      form.dept.value = data.dept || "";
      form.title.value = data.title || "";
      form.content.value = data.content || "";
      uploadedImageUrl = data.imageUrl || "";
      if (uploadedImageUrl) {
        previewImage.src = uploadedImageUrl;
        previewImage.style.display = "block";
        deleteImageBtn.style.display = "inline-block";
      }
      form.dataset.editId = id;
    });
  });

  // 🗑️ 삭제 버튼 이벤트
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

      // ✅ 권한 확인: 관리자 or 본인 글만 삭제 가능
      if (data.authorUid !== currentUser.uid && role !== "admin") {
        return alert("⚠️ 본인 작성 글 또는 관리자만 삭제할 수 있습니다.");
      }

      if (confirm("정말 삭제하시겠습니까?")) {
        await updateDoc(docRef, { deleted: true, deletedAt: serverTimestamp() });
        alert("🗑️ 게시글이 비활성화되었습니다.");
      }
    });
  });
});


// ✅ 학과 선택 스크롤
const deptSelect = document.getElementById("deptSelect");
if (deptSelect) {
  deptSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) return;
    const targetSection = document.querySelector(`.${value}`);
    if (targetSection) targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
