@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE="

for /f "delims=" %%P in ('dir /b /ad "%LocalAppData%\Programs\Python\Python*" 2^>nul') do (
  if exist "%LocalAppData%\Programs\Python\%%P\python.exe" set "PYTHON_EXE=%LocalAppData%\Programs\Python\%%P\python.exe"
)

if not defined PYTHON_EXE (
  where py >nul 2>nul
  if not errorlevel 1 set "PYTHON_EXE=py -3"
)

if not defined PYTHON_EXE (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_EXE=python"
)

if not defined PYTHON_EXE (
  echo Python not found. Please install Python 3 first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "backend\.venv" (
  echo Creating Python virtual environment...
  %PYTHON_EXE% -m venv "backend\.venv"
  if errorlevel 1 (
    echo Failed to create Python virtual environment.
    echo Current Python command: %PYTHON_EXE%
    pause
    exit /b 1
  )
)

if not exist "backend\.venv\Scripts\activate.bat" (
  echo Virtual environment activation script not found:
  echo backend\.venv\Scripts\activate.bat
  echo Please delete backend\.venv and run start.bat again.
  pause
  exit /b 1
)

call "backend\.venv\Scripts\activate.bat"
python -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
  echo Failed to install Python dependencies.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\electron.cmd" (
  echo Installing Node dependencies...
  call npm install --include=dev
  if errorlevel 1 (
    echo Failed to install Node dependencies.
    pause
    exit /b 1
  )
)

if not exist "node_modules\.bin\electron.cmd" (
  echo Electron was not installed successfully.
  echo Please check npm network/proxy settings, then run start.bat again.
  pause
  exit /b 1
)

call npm start
if errorlevel 1 (
  echo DesktopWidget failed to start.
  pause
  exit /b 1
)
