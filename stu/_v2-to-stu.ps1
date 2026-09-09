# ============================================================
#  S:NOW  —  v2 폴더 내용을 stu 로 올리고 옛 v1 파일을 정리합니다.
#  실행: 같은 폴더의 "정리-실행.bat" 을 더블클릭하세요.
# ============================================================
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location -LiteralPath $root

function Line { Write-Host ("-" * 62) -ForegroundColor DarkGray }

Write-Host ""
Write-Host "  S:NOW  폴더 정리" -ForegroundColor Cyan
Write-Host "  $root"
Line

if (-not (Test-Path 'v2\index.html')) {
  Write-Host "  [!] v2\index.html 을 찾을 수 없습니다." -ForegroundColor Red
  Write-Host "      이 스크립트는 stu 폴더 안에서 실행해야 합니다."
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit 1
}

$oldFiles = @(
  'admin.html','firebase.js','index.html','main.js',
  'manifest.json','random.html','service-worker.js','style.css',
  'firebase-debug.log','firestore-debug.log'
) | Where-Object { Test-Path -LiteralPath $_ }

$moving = @(Get-ChildItem -LiteralPath 'v2' -Force)

Write-Host "  [1] 삭제할 옛 파일  ($($oldFiles.Count)개)" -ForegroundColor Yellow
if ($oldFiles.Count -eq 0) { Write-Host "      (없음)" }
foreach ($f in $oldFiles) { Write-Host "      -  $f" }

Write-Host ""
Write-Host "  [2] v2 에서 위로 올릴 항목  ($($moving.Count)개)" -ForegroundColor Yellow
foreach ($m in $moving) {
  $tag = if ($m.PSIsContainer) { '[폴더] ' } else { '       ' }
  Write-Host "      +  $tag$($m.Name)"
}

Write-Host ""
Write-Host "  icons, video 폴더는 그대로 둡니다." -ForegroundColor Green
Write-Host "  git 저장소라 실수해도 복구됩니다. 먼저 커밋해 두시면 더 안전합니다." -ForegroundColor DarkGray
Line

$ok = Read-Host "  진행할까요?  Y 를 입력하고 엔터"
if ($ok -notmatch '^[Yy]') {
  Write-Host "`n  취소했습니다. 아무것도 바꾸지 않았습니다." -ForegroundColor DarkGray
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit
}

Write-Host ""
try {
  foreach ($f in $oldFiles) {
    Remove-Item -LiteralPath $f -Force -ErrorAction Stop
    Write-Host "  삭제  $f" -ForegroundColor DarkGray
  }
  foreach ($m in $moving) {
    Move-Item -LiteralPath $m.FullName -Destination $root -Force -ErrorAction Stop
    Write-Host "  이동  $($m.Name)" -ForegroundColor DarkGray
  }
  $left = @(Get-ChildItem -LiteralPath 'v2' -Force)
  if ($left.Count -eq 0) {
    Remove-Item -LiteralPath 'v2' -Recurse -Force -ErrorAction Stop
    Write-Host "  삭제  v2 (빈 폴더)" -ForegroundColor DarkGray
  } else {
    Write-Host "  [!] v2 에 $($left.Count)개가 남아 폴더를 지우지 않았습니다." -ForegroundColor Yellow
  }
}
catch {
  Line
  Write-Host "  [!] 중간에 오류가 났습니다:" -ForegroundColor Red
  Write-Host "      $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "      git status 로 상태를 확인한 뒤 알려주세요." -ForegroundColor Red
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit 1
}

Line
$fail = $false
foreach ($need in @('index.html','admin.html','manifest.json','service-worker.js',
                    'firestore.rules','css\app.css','js\app.js','icons','video')) {
  if (Test-Path -LiteralPath $need) {
    Write-Host "  OK    $need" -ForegroundColor Green
  } else {
    Write-Host "  없음  $need" -ForegroundColor Red
    $fail = $true
  }
}

$hit = Select-String -LiteralPath 'index.html' -Pattern 'app\.css\?v=([0-9.]+)' | Select-Object -First 1
if ($hit) { Write-Host "`n  index.html 이 참조하는 버전: v$($hit.Matches[0].Groups[1].Value)" -ForegroundColor Cyan }

Line
if ($fail) {
  Write-Host "  일부 항목이 비었습니다. 위 목록을 확인해 주세요." -ForegroundColor Red
} else {
  Write-Host "  정리 완료!" -ForegroundColor Green
  Write-Host ""
  Write-Host "  마무리 순서"
  Write-Host "    1. git add -A  후 커밋 / 푸시 (또는 서버 업로드)"
  Write-Host "    2. 브라우저에서 /stu/ 를 Ctrl+Shift+R 로 강력 새로고침"
  Write-Host "       (옛 서비스워커가 남아 있어 첫 한 번은 필요합니다)"
  Write-Host "    3. 더보기 맨 아래에 'S:NOW v2.0.2' 가 보이면 정상입니다"
  Write-Host ""
  Write-Host "  이 스크립트 2개(정리-실행.bat, _v2-to-stu.ps1)는 지우셔도 됩니다." -ForegroundColor DarkGray
}
Write-Host ""
Read-Host "  엔터를 누르면 닫힙니다" | Out-Null
