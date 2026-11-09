@echo off
setlocal EnableExtensions
title Central de Documentos
cd /d "%~dp0"
set "ROOT=%~dp0"

rem --- guardas: sistema instalado? ---
set "NODE_V="
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_V=%%v"
if not defined NODE_V (
    echo Node.js nao encontrado. Execute instalar.bat primeiro.
    pause
    exit /b 1
)
if not exist ".next\standalone\server.js" (
    echo Build de producao nao encontrado. Execute instalar.bat primeiro.
    pause
    exit /b 1
)

rem --- configuracao (edite a porta aqui se precisar) ---
set "PORT=3000"
set "HOSTNAME=127.0.0.1"

rem --- banco de dados: sempre dentro da pasta do sistema (portatil) ---
set "APP_FWD=%ROOT:\=/%"
set "DATABASE_URL=file:%APP_FWD%data/banco.db"
if not exist "data\banco.db" (
    echo Banco de dados nao encontrado em data\banco.db.
    echo Execute instalar.bat primeiro.
    pause
    exit /b 1
)

rem --- segredo de sessao (recria se apagado) ---
set "AUTH_SECRET="
if exist "data\auth.secret" for /f "usebackq delims=" %%a in ("data\auth.secret") do set "AUTH_SECRET=%%a"
if not defined AUTH_SECRET (
    for /f %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "AUTH_SECRET=%%a"
    >"data\auth.secret" echo %AUTH_SECRET%
)

rem --- garante atalho no Desktop (recria se foi apagado) ---
powershell -NoProfile -Command "$d = [Environment]::GetFolderPath('Desktop'); $p = \"$d\Central de Documentos.lnk\"; if (-not (Test-Path -LiteralPath $p)) { $s = (New-Object -ComObject WScript.Shell).CreateShortcut($p); $s.TargetPath = '%~dp0iniciar.bat'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Central de Documentos'; $s.Save() }"

echo ============================================
echo   Central de Documentos
echo   Node %NODE_V%  ^|  porta %PORT%
echo   Abrira o navegador em alguns instantes...
echo   Feche esta janela para PARAR o sistema.
echo ============================================
echo.

rem abre o navegador depois que o servidor subir
start "" /min cmd /c "timeout /t 6 /nobreak >nul & start "" http://127.0.0.1:%PORT%"

rem servidor em primeiro plano (logs visiveis nesta janela)
node ".next\standalone\server.js"

echo.
echo Servidor encerrado.
pause
