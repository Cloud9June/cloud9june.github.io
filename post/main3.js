// 테스트 버전:
// - 업로드 크롭 비율을 16:9로 완화
// - 기존 main2.js 로직은 그대로 재사용

const OriginalCropper = window.Cropper;

if (OriginalCropper) {
  class RelaxedCropper extends OriginalCropper {
    constructor(element, options = {}) {
      super(element, { ...options, aspectRatio: 16 / 9 });
    }
  }

  const originalGetCroppedCanvas = OriginalCropper.prototype.getCroppedCanvas;
  RelaxedCropper.prototype.getCroppedCanvas = function (options = {}) {
    if (options && options.width === 1000 && options.height === 400) {
      return originalGetCroppedCanvas.call(this, {
        ...options,
        width: 1600,
        height: 900,
      });
    }
    return originalGetCroppedCanvas.call(this, options);
  };

  window.Cropper = RelaxedCropper;
}

// 게시글 에디터(Quill) 글자 크기 — Quill `formats/size` (6단계: 작게1 + Normal + 크게4)
const QUILL_FONT_SIZES = ["sm", false, "up1", "up2", "up3", "up4"];
// 예전 게시글(small/large/huge) 편집 시 포맷이 지워지지 않게 whitelist에만 유지 — 메뉴에는 안 넣음
const QUILL_SIZE_WHITELIST = ["small", "large", "huge", ...QUILL_FONT_SIZES];

(function setupQuillFontSize() {
  if (typeof Quill === "undefined") return;

  let SizeStyle;
  try {
    SizeStyle = Quill.import("formats/size");
  } catch {
    return;
  }
  if (!SizeStyle) return;

  SizeStyle.whitelist = QUILL_SIZE_WHITELIST;
  Quill.register(SizeStyle, true);

  const OriginalQuill = Quill;

  function mergeToolbarOptions(options) {
    if (!options || !options.modules?.toolbar?.container || !Array.isArray(options.modules.toolbar.container)) {
      return options;
    }

    const { container } = options.modules.toolbar;
    const hasSize = container.some((row) =>
      Array.isArray(row) &&
      row.some((cell) => cell && typeof cell === "object" && Object.prototype.hasOwnProperty.call(cell, "size")),
    );
    if (hasSize) return options;

    const newContainer = [...options.modules.toolbar.container];
    newContainer.splice(2, 0, [{ size: QUILL_FONT_SIZES }]);

    return {
      ...options,
      modules: {
        ...options.modules,
        toolbar: {
          ...options.modules.toolbar,
          container: newContainer,
        },
      },
    };
  }

  function PatchedQuill(selector, options) {
    return new OriginalQuill(selector, mergeToolbarOptions(options ? { ...options } : options));
  }

  PatchedQuill.import = OriginalQuill.import.bind(OriginalQuill);
  PatchedQuill.register = OriginalQuill.register.bind(OriginalQuill);
  PatchedQuill.find = OriginalQuill.find.bind(OriginalQuill);
  PatchedQuill.sources = OriginalQuill.sources;
  if (OriginalQuill.debug !== undefined) PatchedQuill.debug = OriginalQuill.debug;
  if (OriginalQuill.imports) PatchedQuill.imports = OriginalQuill.imports;
  PatchedQuill.prototype = OriginalQuill.prototype;

  window.Quill = PatchedQuill;
})();

function startMobileIntro() {
  const isMobile = window.innerWidth <= 768;
  const introArea = document.getElementById("mobileIntro");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!isMobile || !introArea) return;

  // 인트로 시작
  introArea.style.display = "block";
  if (mobileMenu) mobileMenu.style.display = "none";

  const slides = document.querySelectorAll(".intro-slide");
  let currentSlide = 0;

  // 1.2초마다 사진 교체 (총 4장 = 약 5~6초 소요)
  const slideInterval = setInterval(() => {
    slides[currentSlide].classList.remove("active");
    currentSlide++;

    if (currentSlide < slides.length) {
      slides[currentSlide].classList.add("active");
    } else {
      clearInterval(slideInterval);
      finishIntro();
    }
  }, 1200);

  function finishIntro() {
    // 위로 스윽 사라지는 애니메이션 (선택 사항)
    introArea.style.transition = "transform 0.8s ease-in-out, opacity 0.5s";
    introArea.style.transform = "translateY(-100%)";
    introArea.style.opacity = "0";

    setTimeout(() => {
      introArea.style.display = "none";
      if (mobileMenu) {
        mobileMenu.style.display = "block";
        // 메뉴판이 나타날 때 부드럽게 보이게 하기
        mobileMenu.style.animation = "fadeIn 0.5s";
      }
    }, 800);
  }
}

// 스크립트 하단 실행부
window.addEventListener("load", startMobileIntro);

import("./main2.js");
