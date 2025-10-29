import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
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
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc
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
        // ✅ 크롭 모달 생성
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

        // ✅ Cropper.js 초기화
        const image = document.getElementById("cropImage");
        const cropper = new Cropper(image, {
          aspectRatio: 5 / 2,
          viewMode: 1,
          autoCropArea: 1,
          responsive: true,
          background: false,
        });

        // ✅ 자르기 완료
        document.getElementById("cropConfirmBtn").onclick = async () => {
          const canvas = cropper.getCroppedCanvas({ width: 1000, height: 400 });
          const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg"));
          await uploadToCloudinary(blob);
          cropper.destroy();
          cropModal.remove();
        };

        // ✅ 취소 버튼
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
  } catch (e) {
    alert("로그인 실패: " + e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload(); // ✅ 새로고침
});

// ✅ 로그인 상태 감시
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
      openPostModal.style.display = "inline-block";
    } else {
      alert("🚫 접근 권한이 없습니다.");
      await signOut(auth);
    }
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    openPostModal.style.display = "none";
    postModal.style.display = "none";
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
      const updateData = {
        dept,
        title,
        content,
        updatedAt: serverTimestamp(),
      };
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

// ✅ 실시간 피드
const feedRef = collection(db, "feeds");
const q = query(feedRef, orderBy("createdAt", "asc"));

onSnapshot(q, (snapshot) => {
  document.querySelectorAll(".column").forEach((col) => {
    const deptName = col.classList[1];
    col.innerHTML = `<h2>${deptName}</h2>`;
  });

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const section = document.querySelector(`.${data.dept}`);

    if (section) {
      section.innerHTML += `
        <div class="card" data-id="${docSnap.id}">
          ${data.imageUrl ? `<img src="${data.imageUrl}" alt="">` : ""}
          <div class="card-content">
            <h3>${data.title}</h3>
            <p style="white-space: pre-line;">${data.content}</p>
            <div class="author">작성자: ${data.author}</div>
            ${
              auth.currentUser
                ? `<div class="actions"><button class="editBtn">수정</button><button class="deleteBtn">삭제</button></div>`
                : ""
            }
          </div>
        </div>`;
    }
  });

  // 수정 / 삭제 이벤트
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".card");
      const id = card.dataset.id;
      const docRef = doc(db, "feeds", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return alert("데이터를 불러올 수 없습니다.");

      const data = docSnap.data();
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

  document.querySelectorAll(".deleteBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".card").dataset.id;
      if (confirm("정말 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "feeds", id));
        alert("게시글이 삭제되었습니다.");
      }
    });
  });
});

// ✅ 학과 선택 시 해당 섹션으로 스크롤 이동
const deptSelect = document.getElementById("deptSelect");

if (deptSelect) {
  deptSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) return;

    const targetSection = document.querySelector(`.${value}`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// ✅ 로그인 상태일 때만 셀렉트 표시
onAuthStateChanged(auth, async (user) => {
  const deptSelect = document.getElementById("deptSelect");
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      deptSelect.style.display = "block";
    } else {
      deptSelect.style.display = "none";
    }
  } else {
    deptSelect.style.display = "none";
  }
});
