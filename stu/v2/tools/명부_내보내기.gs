/**
 * 명부_내보내기.gs
 * ------------------------------------------------------------
 * 기존 명부 스프레드시트를 S:NOW 관리 콘솔의 "일괄 등록" 형식으로 바꿔 줍니다.
 *
 * 왜 Firestore 에 직접 쓰지 않나요?
 *   Apps Script 에서 Firestore 에 쓰려면 서비스 계정 키를 스크립트 안에 넣어야 하고,
 *   그 키가 유출되면 데이터베이스 전체가 열립니다. 학교 환경에서는 위험이 큽니다.
 *   대신 붙여넣기용 텍스트만 만들고, 실제 저장은 관리자가 로그인한 상태에서
 *   관리 콘솔이 합니다. (보안 규칙이 총관리자인지 서버에서 확인합니다.)
 *
 * 사용법
 *   1. 명부 스프레드시트를 열고 [확장 프로그램] → [Apps Script] 에 이 코드를 붙여넣습니다.
 *   2. 아래 SOURCE / COL 설정을 실제 시트에 맞게 고칩니다.
 *   3. 저장 후 makeImportText 함수를 실행합니다.
 *   4. "S:NOW_붙여넣기" 시트가 생깁니다. A열 전체를 복사해서
 *      관리 콘솔 → 명부·권한 → [일괄 등록] 에 붙여넣고 등록합니다.
 * ------------------------------------------------------------
 */

/* ── 설정 ──────────────────────────────────────────────── */
var SOURCE = '명부';        // 읽어올 시트 이름
var FIRST_ROW = 2;          // 데이터가 시작하는 행 (1은 머리글)

// 각 정보가 몇 번째 열에 있는지 (A=1, B=2, ...)
var COL = {
  email: 1,   // 이메일
  name: 2,   // 이름
  role: 3,   // 역할 ("교사" 또는 비워두면 학생)
  grade: 4,   // 학년
  klass: 5,   // 반
  number: 6,   // 번호
  priv: 7    // 권한 (쉼표로 여러 개: "담임,관리자")
};

var OUTPUT = 'S:NOW_붙여넣기';
var DOMAIN = '@sungil-i.kr';

/* ── 실행 ──────────────────────────────────────────────── */
function makeImportText() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName(SOURCE);
  if (!src) throw new Error('시트를 찾을 수 없습니다: ' + SOURCE);

  var values = src.getDataRange().getValues();
  var lines = [];
  var skipped = [];

  for (var r = FIRST_ROW - 1; r < values.length; r++) {
    var row = values[r];
    var email = String(pick(row, COL.email)).trim().toLowerCase();

    if (!email) continue;
    if (email.indexOf(DOMAIN) === -1) { skipped.push((r + 1) + '행: ' + email); continue; }

    var role = String(pick(row, COL.role)).trim() === '교사' ? '교사' : '학생';
    var priv = String(pick(row, COL.priv)).trim()
      .split(/[,|·\/]/)
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p; })
      .join('|');

    lines.push([
      email,
      String(pick(row, COL.name)).trim(),
      role,
      numOrBlank(pick(row, COL.grade)),
      numOrBlank(pick(row, COL.klass)),
      numOrBlank(pick(row, COL.number)),
      priv
    ].join(', '));
  }

  var out = ss.getSheetByName(OUTPUT) || ss.insertSheet(OUTPUT);
  out.clear();
  out.getRange(1, 1).setValue('이메일, 이름, 역할, 학년, 반, 번호, 권한');
  if (lines.length) {
    out.getRange(2, 1, lines.length, 1).setValues(lines.map(function (l) { return [l]; }));
  }
  out.setColumnWidth(1, 640);
  out.getRange(1, 1).setFontWeight('bold');

  var msg = lines.length + '명을 만들었습니다.\n\n'
    + '"' + OUTPUT + '" 시트의 A열을 복사해서\n'
    + '관리 콘솔 → 명부·권한 → [일괄 등록] 에 붙여넣으세요.';
  if (skipped.length) {
    msg += '\n\n건너뛴 줄 (' + skipped.length + '개):\n' + skipped.slice(0, 10).join('\n');
  }
  SpreadsheetApp.getUi().alert(msg);
}

/* ── 헬퍼 ──────────────────────────────────────────────── */
function pick(row, col) {
  return (col && col <= row.length) ? row[col - 1] : '';
}

function numOrBlank(v) {
  var n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? '' : String(n);
}

/**
 * ⚠️ 마이그레이션이 끝나면 반드시 하세요
 *
 * 기존 S:NOW 가 쓰던 Apps Script 웹앱(/exec?email=... 로 학생 정보를 돌려주던 것)은
 * 인증 없이 누구나 조회할 수 있는 상태입니다.
 *
 *   [배포] → [배포 관리] → 해당 배포 → [보관처리]
 *
 * 로 반드시 중지해 주세요. v2 앱은 이 엔드포인트를 전혀 사용하지 않습니다.
 */
