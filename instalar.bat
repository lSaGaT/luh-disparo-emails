@echo off
setlocal EnableExtensions
title Instalador - Central de Documentos
cd /d "%~dp0"
set "ROOT=%~dp0"

echo ============================================
echo   Central de Documentos - Instalacao
echo ============================================
echo Pasta do sistema: %ROOT%
echo.

rem ---------------------------------------------------------------
rem [1/8] Node.js >= 20.9 (obrigatorio)
rem ---------------------------------------------------------------
set "NODE_V="
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_V=%%v"
set "NODE_MAJOR=0"
if defined NODE_V for /f "tokens=1,2 delims=v." %%a in ("%NODE_V%") do set "NODE_MAJOR=%%a"

if %NODE_MAJOR% GEQ 20 goto :node_ready

rem Node ausente/antigo: instalacao exige administrador (MSI global)
net session >nul 2>&1
if %errorlevel%==0 goto :install_node
echo Node.js 20+ nao encontrado. A instalacao precisa de permissao de
echo administrador (vai aparecer um aviso do Windows - confirme).
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b 1

:install_node
echo [1/8] Instalando Node.js LTS (obrigatorio)...
where winget >nul 2>nul
if %errorlevel% NEQ 0 goto :msi_node
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
goto :after_node

:msi_node
echo winget indisponivel - baixando instalador oficial do nodejs.org...
powershell -NoProfile -Command "$i = Invoke-RestMethod https://nodejs.org/dist/index.json; $l = ($i | Where-Object { $_.lts } | Select-Object -First 1); $u = \"https://nodejs.org/dist/$($l.version)/win-x64/node-$($l.version)-x64.msi\"; Write-Host \"Baixando Node $u\"; Invoke-WebRequest -Uri $u -OutFile \"$env:TEMP\node-install.msi\""
if not exist "%TEMP%\node-install.msi" goto :fail_node
msiexec /i "%TEMP%\node-install.msi" /qn /norestart
del "%TEMP%\node-install.msi" >nul 2>nul

:after_node
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
set "NODE_V="
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_V=%%v"
if not defined NODE_V goto :fail_node
echo Node.js instalado: %NODE_V%

:node_ready
if defined NODE_V echo [1/8] Node.js OK: %NODE_V%

rem ---------------------------------------------------------------
rem [2/8] Pastas + banco de dados (sempre dentro da pasta do sistema)
rem ---------------------------------------------------------------
echo [2/8] Preparando banco de dados local...
if not exist "data" mkdir "data"
rem migra banco antigo (db\custom.db), se existir, para o novo local
if exist "db\custom.db" if not exist "data\banco.db" copy /Y "db\custom.db" "data\banco.db" >nul
set "APP_FWD=%ROOT:\=/%"
set "DATABASE_URL=file:%APP_FWD%data/banco.db"

rem ---------------------------------------------------------------
rem [3/8] Segredo de sessao (AUTH_SECRET >= 32 chars, gerado 1x)
rem ---------------------------------------------------------------
set "AUTH_SECRET="
if exist "data\auth.secret" for /f "usebackq delims=" %%a in ("data\auth.secret") do set "AUTH_SECRET=%%a"
if defined AUTH_SECRET goto :secret_ok
echo [3/8] Gerando segredo de sessao...
for /f %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "AUTH_SECRET=%%a"
>"data\auth.secret" echo %AUTH_SECRET%
:secret_ok
echo [3/8] Segredo OK (data\auth.secret).

rem ---------------------------------------------------------------
rem [4/8] Dependencias
rem ---------------------------------------------------------------
echo [4/8] Instalando dependencias (pode demorar alguns minutos)...
if exist package-lock.json (
    call npm ci --no-audit --no-fund || call npm install --no-audit --no-fund || call npm install --no-audit --no-fund --legacy-peer-deps
) else (
    call npm install --no-audit --no-fund --legacy-peer-deps
)
if errorlevel 1 goto :fail_deps

rem ---------------------------------------------------------------
rem [5/8] Prisma client
rem ---------------------------------------------------------------
echo [5/8] Gerando Prisma client...
call npx prisma generate
if errorlevel 1 goto :fail_db

rem ---------------------------------------------------------------
rem [6/8] Schema no banco
rem ---------------------------------------------------------------
echo [6/8] Criando/atualizando tabelas...
call npx prisma db push --skip-generate
if errorlevel 1 goto :fail_db

rem ---------------------------------------------------------------
rem [7/8] Build de producao
rem ---------------------------------------------------------------
echo [7/8] Compilando producao (pode demorar varios minutos)...
call npx next build --webpack
if errorlevel 1 goto :fail_build
rem replica o que o build script faz (cp -r e comando Unix - nao existe no cmd)
robocopy ".next\static" ".next\standalone\.next\static" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :fail_build
robocopy "public" ".next\standalone\public" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :fail_build
rem garante engine do Prisma dentro do standalone
robocopy "node_modules\.prisma\client" ".next\standalone\node_modules\.prisma\client" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :fail_build

rem ---------------------------------------------------------------
rem [8/8] Atalho na area de trabalho
rem ---------------------------------------------------------------
echo [8/8] Criando atalho na area de trabalho...
powershell -NoProfile -Command "$d = [Environment]::GetFolderPath('Desktop'); $p = \"$d\Central de Documentos.lnk\"; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($p); $s.TargetPath = '%~dp0iniciar.bat'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Central de Documentos'; $s.Save()"
echo [8/8] Atalho criado: "Central de Documentos".

echo.
echo ============================================
echo   Instalacao concluida com sucesso!
echo   Para iniciar: atalho no Desktop ou iniciar.bat
echo ============================================
echo.
set "START_NOW="
set /p START_NOW="Iniciar o sistema agora? (S/N): "
if /i "%START_NOW%"=="S" call "%~dp0iniciar.bat"
exit /b 0

:fail_node
echo.
echo ERRO: nao foi possivel instalar o Node.js automaticamente.
echo Instale manualmente: https://nodejs.org (versao LTS, 20.9 ou superior)
echo Depois execute instalar.bat novamente.
pause
exit /b 1

:fail_deps
echo.
echo ERRO: falha ao instalar dependencias (npm).
echo Verifique sua conexao com a internet e execute instalar.bat novamente.
pause
exit /b 1

:fail_db
echo.
echo ERRO: falha na preparacao do banco de dados (Prisma).
pause
exit /b 1

:fail_build
echo.
echo ERRO: falha na compilacao de producao (next build).
pause
exit /b 1
