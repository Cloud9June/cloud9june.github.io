@echo off
chcp 65001 >nul
cd /d "%~dp0"

where java >/dev/null 2>&1
if errorlevel 1 (
  echo [!] Java 가 없습니다. https://adoptium.net/ 에서 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 처음 실행이라 필요한 패키지를 내려받습니다. 잠시 걸립니다...
  call npm install
  if errorlevel 1 ( echo [!] npm install 실패 & pause & exit /b 1 )
)

echo.
echo == S:NOW 보안 규칙 테스트 ==
echo.
call npm test

echo.
pause
