# build.ps1
# Эта версия автоматически находит node.exe, решая проблемы с NVM и PATH.

Clear-Host
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Rebuilding image-manifest.json..." -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

try {
    # Шаг 1: Динамически найти полный путь к node.exe
    Write-Host "Locating Node.js executable..." -ForegroundColor Cyan
    $NodeCommand = Get-Command node -ErrorAction Stop
    $NodeExecutable = $NodeCommand.Source
    Write-Host "Node.js found at: $NodeExecutable" -ForegroundColor White
    Write-Host ""

    # Шаг 2: Запустить Node.js скрипт, используя найденный путь
    Write-Host "Executing script: create-image-manifest.js" -ForegroundColor Cyan
    & $NodeExecutable create-image-manifest.js

} catch {
    # Этот блок сработает, если команда 'Get-Command node' не найдет node.exe
    Write-Host ""
    Write-Host "[FATAL ERROR] The 'node' command was not found in this PowerShell session." -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible Fix: Try running this script from a PowerShell window that you open manually." -ForegroundColor White
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Done." -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Пауза, чтобы окно не закрылось сразу
pause