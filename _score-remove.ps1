# ============================================================
#  score/ 성적 조회 모듈 제거
#
#  ⚠ 이 스크립트를 돌리기 전에 Apps Script 배포부터 내리세요.
#     파일을 지워도 배포된 주소는 git 이력에 남아 계속 동작합니다.
#
#     script.google.com → 성적 관련 프로젝트 → 배포 → 배포 관리
#     아래 두 배포를 [보관처리]:
#       AKfycby56tCKVONzEwQ1rqnsAH8DYzwiKnXxTnp1KmW2hVD5hNqP7SMf7BMRvMeE1GtxZ52k   (subject 1, 2)
#       AKfycbzQp0prLc…                                                            (subject 3)
#
#  두 배포 모두 score/ 에서만 쓰이므로 다른 기능에 영향이 없습니다.
# ============================================================
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location -LiteralPath $root

function Line { Write-Host ("-" * 62) -ForegroundColor DarkGray }

Write-Host ""
Write-Host "  score/ 성적 조회 모듈 제거" -ForegroundColor Cyan
Write-Host "  $root"
Line

if (-not (Test-Path 'score')) {
  Write-Host "  score 폴더가 이미 없습니다." -ForegroundColor Yellow
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit
}

$files = @(Get-ChildItem -LiteralPath 'score' -Recurse -Force -File)
Write-Host "  삭제할 파일 $($files.Count)개" -ForegroundColor Yellow
foreach ($f in $files) { Write-Host "      -  score\$($f.Name)" }

Write-Host ""
Write-Host "  ※ Apps Script 배포 2개를 먼저 보관처리하셨나요?" -ForegroundColor Red
Write-Host "     배포가 살아 있으면 파일을 지워도 성적이 계속 조회됩니다." -ForegroundColor Red
Line

$ok = Read-Host "  배포를 내렸고 폴더를 삭제할까요?  Y 를 입력하고 엔터"
if ($ok -notmatch '^[Yy]') {
  Write-Host "`n  취소했습니다. 아무것도 바꾸지 않았습니다." -ForegroundColor DarkGray
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit
}

try {
  Remove-Item -LiteralPath 'score' -Recurse -Force -ErrorAction Stop
  Write-Host "`n  삭제 완료: score\" -ForegroundColor Green
}
catch {
  Write-Host "`n  [!] 삭제 실패: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit 1
}

Line
Write-Host "  다음 순서"
Write-Host "    1. git add -A"
Write-Host '    2. git commit -m "성적 조회 모듈 제거 (운영 종료)"'
Write-Host "    3. git push"
Write-Host ""
Write-Host "  파일은 git 이력에 남지만, 배포를 내렸다면 그 주소는 죽은 주소입니다."
Write-Host "  score/ 안에는 학생 이름이 없고 조회 화면만 있으므로 이력 노출 문제도 함께 해결됩니다." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  엔터를 누르면 닫힙니다" | Out-Null
