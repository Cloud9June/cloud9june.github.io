// ==========================================================
// 📋 정적 데이터 (실습실 목록 / 고장 사유 옵션)
//    로직 파일(script.js)과 분리하여 실습실이 추가/변경될 때
//    이 파일만 수정하면 되도록 구성
// ==========================================================

export const labs = [
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

// 좌석 상태 변경 모달에서 사용하는 고장 사유 옵션.
// ⚠️ value는 Firestore의 seat.status 필드에 그대로 저장되므로 반드시 서로 달라야 함
//    (원본 코드는 "모니터 고장"과 "키보드/마우스 고장"이 둘 다 value="hardware" 로 겹쳐 있었음 → 아래에서 분리)
export const ISSUE_OPTIONS = [
  { value: "normal", label: "✅ 정상 (수리완료)" },
  { value: "booting", label: "❌ 부팅 안됨" },
  { value: "power", label: "🔌 전원 안 켜짐" },
  { value: "monitor", label: "🖥️ 모니터 고장/파손" },
  { value: "network", label: "🌐 인터넷/네트워크 오류" },
  { value: "sw", label: "💾 프로그램 없음/오류" },
  { value: "peripheral", label: "⌨️ 키보드/마우스 고장" },
  { value: "etc", label: "기타" },
];

export const HIDDEN_OPTION = { value: "hidden", label: "❌ 이 자리를 비우기 (건너뛰기)" };
export const RESTORE_OPTION = { value: "restore", label: "✅ 다시 좌석으로 사용" };