# build-release.ps1 — MyGate Release APK Builder
# Run from ANYWHERE: powershell -ExecutionPolicy Bypass -File C:\rg\android\build-release.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     MyGate Release APK Builder       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Verify junction ───────────────────────────────────────────────────
if (-not (Test-Path "C:\rg\android")) {
    Write-Host "❌ C:\rg\android not found. Creating junction..." -ForegroundColor Red
    $frontendPath = Split-Path $PSScriptRoot -Parent
    cmd /c "mklink /J C:\rg `"$frontendPath`""
}
Set-Location "C:\rg\android"
Write-Host "✅ Working dir: $(Get-Location)" -ForegroundColor Green

# ── Step 2: Fix CMake dirs ────────────────────────────────────────────────────
Write-Host "`n[1/3] Fixing CMake codegen dirs..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File "C:\rg\android\fix-cmake-dirs.ps1"

# ── Step 3: Build ─────────────────────────────────────────────────────────────
Write-Host "`n[2/3] Building release APK..." -ForegroundColor Yellow
Write-Host "      (This takes 5-10 min on first build, ~2 min with cache)" -ForegroundColor Gray
.\gradlew assembleRelease --build-cache --parallel --configure-on-demand

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ BUILD FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "   Run with --info for details: .\gradlew assembleRelease --info" -ForegroundColor Yellow
    exit $LASTEXITCODE
}

# ── Step 4: Report ────────────────────────────────────────────────────────────
$apk = "C:\rb\MyGate\app\outputs\apk\release\app-release.apk"
if (Test-Path $apk) {
    $size = [math]::Round((Get-Item $apk).Length / 1MB, 1)
    Write-Host "`n[3/3] ✅ BUILD SUCCESS" -ForegroundColor Green
    Write-Host "      APK: $apk" -ForegroundColor Green
    Write-Host "      Size: $size MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install:" -ForegroundColor Cyan
    Write-Host "  adb install -r `"$apk`"" -ForegroundColor White
} else {
    # Try to find it
    $found = Get-ChildItem "C:\rb\MyGate\app\outputs" -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "`n✅ APK found at: $($found[0].FullName)" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  APK not found at expected path. Check C:\rb\MyGate\app\outputs\" -ForegroundColor Yellow
    }
}
