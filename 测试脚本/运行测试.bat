@echo off
chcp 65001 >nul
title 车卡回归测试启动器
echo ========================================
echo   DND 5R 车卡功能回归测试
echo ========================================
echo.

cd /d "%~dp0\.."

rem ---- 1. 启动后端服务（若端口 5001 未被占用）----
echo [0] 正在启动后端服务 (http://127.0.0.1:5001)...
set "FLASK_RELOADER=0"
start "车卡后端服务" /b python TableChronicle\app.py

echo       等待服务就绪...
python -c "import urllib.request,time,sys;ok=False
for _ in range(30):
    try:
        urllib.request.urlopen('http://127.0.0.1:5001',timeout=2); ok=True; break
    except Exception: time.sleep(1)
sys.exit(0 if ok else 1)"
if errorlevel 1 (
    echo   [启动失败] 后端服务未能就绪，测试中止。
    echo   请确认 5001 端口未被其他程序占用，并检查 TableChronicle\app.py 能否正常启动。
    pause
    exit /b 1
)
echo       服务已就绪。
echo.

echo [1/6] 正在运行基础流程测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestCharacterCreation -v --tb=short
echo.

echo [2/6] 正在运行交叉覆盖测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestCrossCoverage -v --tb=short
echo.

echo [3/6] 正在运行数据变更测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestDataChangeValidation -v --tb=short
echo.

echo [4/6] 正在运行导出/导入测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestExportImport -v --tb=short
echo.

echo [5/6] 正在运行解绑功能测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestUnbind -v --tb=short
echo.

echo [6/6] 正在运行回退功能测试...
python -m pytest 测试脚本/车卡_回归测试.py::TestGoBack -v --tb=short
echo.

echo ========================================
echo   全部测试执行完毕
echo ========================================
echo.

rem ---- 2. 停止后端服务 ----
echo 正在停止后端服务...
for /f "tokens=5" %%p in ('netstat -ano | findstr :5001 | findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>&1
)
echo   服务已停止。
echo.
pause