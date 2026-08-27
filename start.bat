@echo off
setlocal enabledelayedexpansion
title EL-SHEMEY - Local Launcher

rem ============================================================
rem  EL-SHEMEY one-click local launcher
rem    - stops anything already occupying port 3000
rem    - ensures the PostgreSQL container is running
rem    - applies migrations + seed (idempotent)
rem    - starts the dev server and opens the browser when ready
rem
rem  Usage:
rem    start.bat              full launch
rem    start.bat setup-only   infrastructure + seed, then stop
rem ============================================================

cd /d "%~dp0"

echo.
echo ============================================
echo   EL-SHEMEY - starting local environment
echo ============================================
echo.

REM ---------- 0. Kill anything occupying port 3000 ----------
set KILLED=0
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000 .*LISTENING" 2^>nul') do (
  echo [PORT] Stopping process %%p using port 3000...
  taskkill /PID %%p /F >nul 2>&1
  set KILLED=1
)
if "%KILLED%"=="1" timeout /t 2 /nobreak >nul

REM ---------- 1. Environment file ----------
if not exist ".env" (
  echo [ENV] No .env found - creating from .env.example
  copy ".env.example" ".env" >nul
  for /f %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))"') do set AUTHGEN=%%s
  echo AUTH_SECRET="!AUTHGEN!" >> ".env"
  echo MAIL_FROM="no-reply@localhost" >> ".env"
)

REM ---------- 2. Database container ----------
docker start elshemey-db >nul 2>&1
if errorlevel 1 (
  echo [DB] Creating PostgreSQL container ^(postgres:16-alpine^)...
  docker run -d --name elshemey-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=elshemey_dev -p 5432:5432 postgres:16-alpine >nul
) else (
  echo [DB] Container elshemey-db ready ^(running or restarted^).
)

:wait_db
echo [DB] Waiting for PostgreSQL to accept connections...
set /a tries=0

:wait_loop
set /a tries+=1
call npx prisma migrate status >nul 2>&1
if not errorlevel 1 goto db_ready
if %tries% geq 15 (
  echo [DB] ERROR: could not reach PostgreSQL after 15 attempts.
  echo      Is Docker running? Start Docker Desktop and retry.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_loop

:db_ready
echo [DB] Connected.

REM ---------- 3. Prisma client ----------
call npx prisma generate >nul 2>&1

REM ---------- 4. Migrations ----------
echo [PRISMA] Applying migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo [PRISMA] ERROR: migration failed.
  pause
  exit /b 1
)

REM ---------- 5. Seed ----------
echo [SEED] Applying deterministic seed...
call npm run db:seed
if errorlevel 1 (
  echo [SEED] ERROR: seed failed.
  pause
  exit /b 1
)

REM ---------- 6. Done / handoff ----------
if /i "%~1"=="setup-only" (
  echo.
  echo [DONE] Infrastructure ready. Run "start.bat" to launch the app.
  exit /b 0
)

echo.
echo [DEV] Starting dev server - waiting until it responds...
start "EL-SHEMEY dev" /min cmd /c "npm run dev"

set /a polls=0

:poll_loop
set /a polls+=1
if %polls% geq 40 (
  echo [DEV] Server did not respond within 80 seconds. Check the dev window.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/en' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto poll_loop

echo [DEV] Server is UP.
start "" http://localhost:3000/en
echo.
echo [DONE] EL-SHEMEY running at http://localhost:3000/en
echo        Keep this window open. Press Ctrl+C to stop everything.
pause
