// ==========================================================
// 📋 정적 데이터 (실습실 목록 / 고장 사유 옵션)
//    로직 파일(script.js)과 분리하여 실습실이 추가/변경될 때
//    이 파일만 수정하면 되도록 구성
// ==========================================================

// location은 실습실이 물리적으로 있는 건물/층. 거의 바뀌지 않는 고정 정보라
// (Firestore가 아니라) 이름/행렬처럼 이 정적 파일에 함께 둔다.
export const labs = [
  { id: "lab_01", name: "컴퓨터 1실", location: "본관 5층", rows: 5, cols: 6 },
  { id: "lab_02", name: "컴퓨터 2실", location: "본관 지하", rows: 8, cols: 6 },
  { id: "lab_03", name: "컴퓨터 3실", location: "별관 4층", rows: 5, cols: 6 },
  { id: "lab_04", name: "컴퓨터 4실", location: "별관 2층", rows: 5, cols: 6 },
  { id: "lab_05", name: "컴퓨터 5실", location: "별관 2층", rows: 5, cols: 6 },
  { id: "lab_06", name: "컴퓨터 6실", location: "별관 2층", rows: 5, cols: 6 },
  { id: "lab_07", name: "컴퓨터 7실", location: "별관 2층", rows: 5, cols: 6 },
  { id: "lab_08", name: "컴퓨터 8실", location: "별관 2층", rows: 5, cols: 6 },
  { id: "lab_09", name: "컴퓨터 9실", location: "별관 3층", rows: 5, cols: 6 },
  { id: "lab_10", name: "컴퓨터 10실", location: "별관 3층", rows: 5, cols: 6 },
  { id: "lab_11", name: "컴퓨터 11실", location: "별관 3층", rows: 5, cols: 6 },
  { id: "lab_12", name: "컴퓨터 12실", location: "별관 4층", rows: 5, cols: 6 },
  { id: "lab_13", name: "컴퓨터 13실", location: "별관 4층", rows: 5, cols: 6 },
  { id: "lab_14", name: "컴퓨터 14실", location: "별관 3층", rows: 5, cols: 6 },
  { id: "lab_multi", name: "멀티미디어실", location: "별관 3층", rows: 5, cols: 6 },
  { id: "lab_15", name: "미디어실습실", location: "자미원", rows: 5, cols: 6 },
];

// 좌석 상태 변경 모달에서 사용하는 고장 사유 옵션.
// ⚠️ value는 Firestore의 seat.status 필드에 그대로 저장되므로 반드시 서로 달라야 함
//    (원본 코드는 "모니터 고장"과 "키보드/마우스 고장"이 둘 다 value="hardware" 로 겹쳐 있었음 → 아래에서 분리)
export const ISSUE_OPTIONS = [
  { value: "normal", label: "정상 (수리완료)" },
  { value: "booting", label: "부팅 안됨" },
  { value: "power", label: "전원 안 켜짐" },
  { value: "monitor", label: "모니터 고장/파손" },
  { value: "network", label: "인터넷/네트워크 오류" },
  { value: "sw", label: "프로그램 없음/오류" },
  { value: "peripheral", label: "키보드/마우스 고장" },
  { value: "etc", label: "기타" },
];

export const HIDDEN_OPTION = { value: "hidden", label: "❌ 이 자리를 비우기 (건너뛰기)" };
export const RESTORE_OPTION = { value: "restore", label: "✅ 다시 좌석으로 사용" };

// 한 학급 정원. 대시보드 카드에서 "고장난 자리가 있어도 수업 진행에는 지장이 없는지"를
// 판단하는 기준으로 쓰인다 (사용 가능한 좌석 수가 이 값 이상이면 "정상 운영"으로 표시).
export const CLASS_CAPACITY = 22;

// 실습실 사양 정보 입력 폼/표시에서 공통으로 쓰는 필드 정의.
// key는 Firestore의 labs/{id}.specs.{key}에 그대로 저장된다.
export const SPEC_FIELDS = [
  { key: "cpu", label: "CPU", placeholder: "예: Intel i5-12400" },
  { key: "ram", label: "메모리(RAM)", placeholder: "예: 16GB" },
  { key: "storage", label: "저장장치", placeholder: "예: SSD 512GB" },
  { key: "gpu", label: "그래픽카드", placeholder: "예: 내장그래픽 / GTX 1650" },
  { key: "monitor", label: "모니터", placeholder: "예: 24인치 FHD" },
  { key: "os", label: "운영체제", placeholder: "예: Windows 11" },
  { key: "note", label: "비고", placeholder: "추가로 적어둘 내용", multiline: true },
];

// 실습실 사양을 한눈에 비교할 수 있도록 매기는 등급. S가 가장 높고 F로 갈수록 낮다.
// S를 제외한 등급은 +/0/- 세 단계로 더 세분화할 수 있다 (예: "B+", "B0", "B-").
// S는 이미 최상위라 세분화 없이 단독으로 쓴다.
// Firestore에는 labs/{id}.grade에 이 중 하나의 값(또는 미평가 시 빈 문자열)으로 저장된다.
export const GRADE_LETTERS = ["S", "A", "B", "C", "D", "E", "F"];
export const GRADE_MODIFIERS = ["+", "0", "-"];