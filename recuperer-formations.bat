@echo off
chcp 65001 >nul
title Recuperer les formations Claude
set "DEST=D:\ELEMENTS COM\CLAUDE"
set "REPO=https://github.com/odaiouattara0022-del/Claude.git"
set "TMPDIR=%TEMP%\claude-formations"

echo.
echo Recuperation des formations dans "%DEST%"...
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git n'est pas installe sur cet ordinateur.
  echo Installez-le depuis https://git-scm.com/download/win puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"

rem Cas 1 : le dossier est deja relie a GitHub
if exist "%DEST%\.git" (
  cd /d "%DEST%"
  git checkout main
  git pull origin main
  goto fin
)

rem Cas 2 : dossier simple, on telecharge puis on copie
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
git clone --depth 1 "%REPO%" "%TMPDIR%"
if errorlevel 1 (
  echo.
  echo Echec du telechargement. Verifiez votre connexion Internet et votre compte GitHub.
  pause
  exit /b 1
)
robocopy "%TMPDIR%" "%DEST%" /E /XD .git /NFL /NDL /NJH /NJS
rmdir /s /q "%TMPDIR%"

:fin
echo.
echo Termine. Les formations sont dans "%DEST%".
start "" "%DEST%"
pause
