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

import("./main2.js");
