@echo off
if /i "%~1"=="reexec" goto :main
rem copia para temp e roda de la: o git substitui este arquivo durante o
rem processo e o cmd nao pode ler o proprio arquivo enquanto ele muda
copy /Y "%~f0" "%TEMP%\atualizar_runner.bat" >nul
cmd /c ""%TEMP%\atualizar_runner.bat" reexec "%~dp0""
exit /b %errorlevel%

:main
setlocal EnableExtensions
title Atualizacao - Central de Documentos
cd /d "%~2"
set "ROOT=%CD%"
if not "%ROOT:~-1%"=="\" set "ROOT=%ROOT%\"
set "REPO_URL=https://github.com/lSaGaT/luh-disparo-emails.git"

echo ============================================
echo   Central de Documentos - Atualizacao
echo ============================================
echo Pasta: %ROOT%
echo (seus dados em data\ nao sao afetados)
echo.

rem ---------------------------------------------------------------
rem Git: obrigatorio para atualizar (instala 1x se faltar)
rem ---------------------------------------------------------------
git --version >nul 2>nul
if %errorlevel%==0 goto :git_ok

net session >nul 2>&1
if %errorlevel%==0 goto :install_git
echo O Git nao esta instalado (necessario uma vez so, para receber
echo atualizacoes). Vai aparecer um aviso de administrador - confirme.
powershell -NoProfile -Command "Start-Process -FilePath '%TEMP%\atualizar_runner.bat' -ArgumentList 'reexec','%~2' -Verb RunAs"
exit /b 1

:install_git
echo Instalando Git...
where winget >nul 2>nul
if %errorlevel% NEQ 0 goto :git_fail
winget install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;C:\Program Files\Git\cmd"
git --version >nul 2>nul
if %errorlevel% NEQ 0 goto :git_fail
echo Git instalado.

:git_ok
rem ---------------------------------------------------------------
rem [1/4] Baixa a versao nova do GitHub
rem ---------------------------------------------------------------
echo [1/4] Buscando versao mais recente...
if not exist ".git" git init -b main >nul 2>nul
git remote add origin %REPO_URL% >nul 2>nul
git remote set-url origin %REPO_URL%
git fetch origin --prune
if errorlevel 1 goto :fetch_fail
git reset --hard origin/main
if errorlevel 1 goto :fetch_fail
echo [1/4] Codigo atualizado.

rem ---------------------------------------------------------------
rem Node presente? (maquina que ja instalou tem; garante na mesma)
rem ---------------------------------------------------------------
set "NODE_V="
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_V=%%v"
if not defined NODE_V (
    echo Node.js nao encontrado. Execute instalar.bat primeiro.
    pause
    exit /b 1
)

set "APP_FWD=%ROOT:\=/%"
set "DATABASE_URL=file:%APP_FWD%data/banco.db"

rem ---------------------------------------------------------------
rem [2/4] Dependencias (rapido se nada mudou)
rem ---------------------------------------------------------------
echo [2/4] Verificando dependencias...
call npm install --no-audit --no-fund || call npm install --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 goto :deps_fail

rem ---------------------------------------------------------------
rem [3/4] Banco de dados (novas tabelas, se houver)
rem ---------------------------------------------------------------
echo [3/4] Preparando banco de dados...
call npx prisma generate
if errorlevel 1 goto :db_fail
call npx prisma db push --skip-generate
if errorlevel 1 goto :db_fail

rem ---------------------------------------------------------------
rem [4/4] Build de producao
rem ---------------------------------------------------------------
echo [4/4] Compilando producao (pode demorar varios minutos)...
call npx next build --webpack
if errorlevel 1 goto :build_fail
robocopy ".next\static" ".next\standalone\.next\static" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :build_fail
robocopy "public" ".next\standalone\public" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :build_fail
robocopy "node_modules\.prisma\client" ".next\standalone\node_modules\.prisma\client" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :build_fail

echo.
echo ============================================
echo   Sistema atualizado com sucesso!
echo   Abra normalmente pelo atalho do Desktop.
echo ============================================
pause
exit /b 0

:git_fail
echo.
echo ERRO: nao foi possivel instalar o Git automaticamente.
echo Baixe e instale manualmente: https://git-scm.com/download/win
echo Depois execute atualizar.bat novamente.
pause
exit /b 1

:fetch_fail
echo.
echo ERRO: falha ao baixar a atualizacao (internet/repo).
echo Verifique a conexao e execute atualizar.bat novamente.
pause
exit /b 1

:deps_fail
echo.
echo ERRO: falha ao instalar dependencias (npm). Verifique internet.
pause
exit /b 1

:db_fail
echo.
echo ERRO: falha na preparacao do banco de dados (Prisma).
pause
exit /b 1

:build_fail
echo.
echo ERRO: falha na compilacao (next build).
pause
exit /b 1
