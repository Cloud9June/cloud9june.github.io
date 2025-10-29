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
const deleteImageBtn = document.getElementById("deleteImageBtn");

let uploadedImageUrl = "";
let imageDeleted = false; // ✅ 이미지 삭제 여부 추적

// ✅ Cloudinary Upload Widget (Crop 기능)
const uploadWidgetBtn = document.getElementById("uploadWidgetBtn");
if (uploadWidgetBtn) {
  const widget = cloudinary.createUploadWidget(
    {
      cloudName: CLOUD_NAME,
      uploadPreset: UPLOAD_PRESET,
      cropping: true,
      croppingAspectRatio: 5 / 2, // ✅ 피드 비율
      multiple: false,
      folder: "images",
      sources: ["local", "camera"],
      clientAllowedFormats: ["jpg", "jpeg", "png"],
      maxImageFileSize: 5 * 1024 * 1024, // 5MB
    },
    (error, result) => {
      if (!error && result && result.event === "success") {
        uploadedImageUrl = result.info.secure_url;
        previewImage.src = uploadedImageUrl;
        previewImage.style.display = "block";
        deleteImageBtn.style.display = "inline-block";
        imageDeleted = false; // 새로 업로드했으니 삭제 상태 해제
      }
    }
  );
  uploadWidgetBtn.addEventListener("click", () => widget.open(), false);
}

// ✅ 이미지 삭제 버튼
if (deleteImageBtn) {
  deleteImageBtn.addEventListener("click", () => {
    if (confirm("이미지를 삭제하시겠습니까?")) {
      uploadedImageUrl = "";
      previewImage.src = "";
      previewImage.style.display = "none";
      deleteImageBtn.style.display = "none";
      imageDeleted = true; // 삭제 표시
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
});

// ✅ 로그인 상태 감시
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      console.log("✅ 등록된 사용자:", user.email);
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
      openPostModal.style.display = "inline-block";
    } else {
      alert("🚫 접근 권한이 없습니다.\n관리자에게 등록 요청하세요.");
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
  imageDeleted = false;
  previewImage.src = "";
  previewImage.style.display = "none";
  deleteImageBtn.style.display = "none";
  postModal.style.display = "flex";
});

// ✅ 모달 닫기
closeModal.addEventListener("click", () => {
  postModal.style.display = "none";
});

// ✅ 모달 바깥 클릭 시 닫기
window.addEventListener("click", (e) => {
  if (e.target === postModal) postModal.style.display = "none";
});

// ✅ 등록 / 수정 공통 처리
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
    let imageUrl = uploadedImageUrl || "";

    if (editId) {
      // ✅ 수정
      const docRef = doc(db, "feeds", editId);
      const updateData = {
        dept,
        title,
        content,
        updatedAt: serverTimestamp(),
      };

      // 🔹 이미지 상태 처리
      if (imageDeleted) {
        updateData.imageUrl = ""; // Firestore에서 필드 제거
      } else if (imageUrl) {
        updateData.imageUrl = imageUrl; // 새 이미지 반영
      }

      await updateDoc(docRef, updateData);
      alert("✅ 게시글이 수정되었습니다!");
    } else {
      // ✅ 신규 등록
      await addDoc(collection(db, "feeds"), {
        dept,
        title,
        content,
        imageUrl,
        author: user.displayName || "000 선생님",
        createdAt: serverTimestamp(),
      });
      alert("✅ 게시글이 등록되었습니다!");
    }

    // ✅ 초기화
    form.reset();
    uploadedImageUrl = "";
    imageDeleted = false;
    previewImage.src = "";
    previewImage.style.display = "none";
    deleteImageBtn.style.display = "none";
    delete form.dataset.editId;
    postModal.style.display = "none";

  } catch (error) {
    console.error(error);
    alert("⚠️ 게시글 처리 중 오류가 발생했습니다.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "등록";
  }
});

// ✅ 실시간 피드 반영
const feedRef = collection(db, "feeds");
const q = query(feedRef, orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  document.querySelectorAll(".column").forEach(col => {
    const deptName = col.classList[1];
    col.innerHTML = `<h2>${deptName}</h2>`;
  });

  snapshot.forEach(docSnap => {
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
            <div class="actions" style="margin-top:6px;text-align:right;">
              <button class="editBtn">수정</button>
              <button class="deleteBtn">삭제</button>
            </div>
          </div>
        </div>
      `;
    }
  });

  // ✏️ 수정 이벤트
  document.querySelectorAll(".editBtn").forEach(btn => {
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

      // ✅ 기존 데이터 세팅
      form.dept.value = data.dept || "";
      form.title.value = data.title || "";
      form.content.value = data.content || "";

      if (data.imageUrl) {
        uploadedImageUrl = data.imageUrl;
        previewImage.src = data.imageUrl;
        previewImage.style.display = "block";
        deleteImageBtn.style.display = "inline-block";
        imageDeleted = false;
      } else {
        previewImage.style.display = "none";
        deleteImageBtn.style.display = "none";
        uploadedImageUrl = "";
      }

      form.dataset.editId = id;
    });
  });

  // 🗑️ 삭제
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".card");
      const id = card.dataset.id;
      if (confirm("정말 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "feeds", id));
        alert("게시글이 삭제되었습니다.");
      }
    });
  });
});
