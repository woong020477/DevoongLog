@echo off
setlocal

REM 사용할 포트 번호
set PORT=8000

REM 이 bat 파일이 있는 폴더 경로
set ROOT=%~dp0

REM 1) 새 CMD 창을 열어서, 해당 폴더에서 파이썬 HTTP 서버 실행
start "DevBlogServer" cmd /k "cd /d ""%ROOT%"" && npx serve -l 8000"

REM 2) 서버가 뜰 시간을 잠깐 기다림 (2초)
timeout /t 2 >nul

REM 3) 브라우저에서 localhost 주소로 index.html 열기
start "" "http://localhost:%PORT%/index.html"