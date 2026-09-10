# ============================================================
#  공개 저장소에서 개인정보가 담긴 파일 정리
#
#  지우는 것 (참조하는 파일이 한 곳도 없음을 확인했습니다)
#    pass\                신입생 18명 이름·출신중학교·반·번호  ★가장 민감
#    led\etc\names.html   학생 실명 251명 (100일 워드클라우드)
#    test\                구 S:NOW 사본 + 교직원 명부 사본 + Apps Script 주소
#    beta\                메인 허브 사본 + 교직원 명부 사본
#    stu\v2\              폴더 정리 때 남은 잔재
#    _v2-to-stu.ps1 / 정리-실행.bat   역할 끝난 스크립트
#
#  건드리지 않는 것
#    award\, kiosk\       수상 데이터 — 키오스크가 실제로 쓰는 화면이라 살려 둡니다
#    led\etc\member.html, person.html   개인정보 없음
#    job\                 졸업생 등록 — 운영 중일 수 있어 판단 필요
#    score\               별도 스크립트(성적모듈-삭제.bat)로 처리
# ============================================================
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location -LiteralPath $root

function Line { Write-Host ("-" * 64) -ForegroundColor DarkGray }

$targets = @(
  @{ path='pass';                 desc='신입생 18명 (이름·출신중학교·반·번호)' },
  @{ path='led\etc\names.html';   desc='학생 실명 251명' },
  @{ path='test';                 desc='구 S:NOW 사본 + 교직원 명부 사본' },
  @{ path='beta';                 desc='메인 허브 사본 + 교직원 명부 사본' },
  @{ path='stu\v2';               desc='폴더 정리 잔재' },
  @{ path='_v2-to-stu.ps1';       desc='역할 끝난 스크립트' },
  @{ path='정리-실행.bat';         desc='역할 끝난 스크립트' }
)

Write-Host ""
Write-Host "  공개 저장소 개인정보 파일 정리" -ForegroundColor Cyan
Write-Host "  $root"
Line

if (-not (Test-Path 'stu\index.html')) {
  Write-Host "  [!] webGit 저장소 루트에서 실행해 주세요." -ForegroundColor Red
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit 1
}

$found = @()
foreach ($t in $targets) {
  if (Test-Path -LiteralPath $t.path) {
    $n = if ((Get-Item -LiteralPath $t.path).PSIsContainer) {
           (Get-ChildItem -LiteralPath $t.path -Recurse -Force -File | Measure-Object).Count
         } else { 1 }
    $found += [pscustomobject]@{ Path=$t.path; Desc=$t.desc; Count=$n }
  }
}

if ($found.Count -eq 0) {
  Write-Host "  지울 대상이 없습니다. 이미 정리되었습니다." -ForegroundColor Green
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit
}

Write-Host "  삭제 대상" -ForegroundColor Yellow
foreach ($f in $found) {
  Write-Host ("      - {0,-22} 파일 {1,3}개   {2}" -f $f.Path, $f.Count, $f.Desc)
}
Write-Host ""
Write-Host "  건드리지 않는 것: award\, kiosk\, job\, score\, led\etc\ 나머지" -ForegroundColor Green
Write-Host "  참조하는 파일이 없는 것을 확인했으므로 끊기는 링크는 없습니다." -ForegroundColor DarkGray
Write-Host "  git 저장소라 되돌릴 수 있습니다. 먼저 커밋해 두시면 더 안전합니다." -ForegroundColor DarkGray
Line

$ok = Read-Host "  삭제할까요?  Y 를 입력하고 엔터"
if ($ok -notmatch '^[Yy]') {
  Write-Host "`n  취소했습니다. 아무것도 바꾸지 않았습니다." -ForegroundColor DarkGray
  Read-Host "`n  엔터를 누르면 닫힙니다" | Out-Null
  exit
}

Write-Host ""
$fail = 0
foreach ($f in $found) {
  try {
    Remove-Item -LiteralPath $f.Path -Recurse -Force -ErrorAction Stop
    Write-Host ("  삭제  {0}" -f $f.Path) -ForegroundColor DarkGray
  } catch {
    Write-Host ("  [!] 실패  {0} — {1}" -f $f.Path, $_.Exception.Message) -ForegroundColor Red
    $fail++
  }
}

Line
if ($fail -gt 0) {
  Write-Host "  $fail 건이 실패했습니다. 파일이 열려 있지 않은지 확인해 주세요." -ForegroundColor Red
} else {
  Write-Host "  정리 완료 — 학생 실명 269건이 저장소에서 사라졌습니다." -ForegroundColor Green
  Write-Host ""
  Write-Host "  다음 순서"
  Write-Host "    1. git add -A"
  Write-Host '    2. git commit -m "개인정보 포함 파일 및 미사용 사본 제거"'
  Write-Host "    3. git push"
  Write-Host ""
  Write-Host "  ※ 파일은 git 이력에 남습니다. 저장소를 비공개로 바꾸면 함께 덮입니다." -ForegroundColor Yellow
}
Write-Host ""
Read-Host "  엔터를 누르면 닫힙니다" | Out-Null
