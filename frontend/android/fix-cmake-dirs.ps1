# fix-cmake-dirs.ps1
# Run this BEFORE every release build to fix CMake codegen JNI directory issues.
#
# IMPORTANT: Always build from C:\rg\android, NOT from the original long path.
# The junction C:\rg -> ritgate-main/frontend/ must exist.
#
# Usage: powershell -ExecutionPolicy Bypass -File C:\rg\android\fix-cmake-dirs.ps1

# ── Verify junction C:\rg exists ─────────────────────────────────────────────
if (-not (Test-Path "C:\rg")) {
    Write-Host "❌ Junction C:\rg does not exist! Creating it now..."
    $frontendPath = Split-Path $PSScriptRoot -Parent
    cmd /c "mklink /J C:\rg `"$frontendPath`""
    if (Test-Path "C:\rg") {
        Write-Host "✅ Junction C:\rg created -> $frontendPath"
    } else {
        Write-Host "❌ Failed to create junction. Run as Administrator."
        exit 1
    }
} else {
    Write-Host "✅ Junction C:\rg exists"
}

# ── Verify C:\rb\MyGate exists ───────────────────────────────────────────────
if (-not (Test-Path "C:\rb\MyGate")) {
    New-Item -ItemType Directory -Path "C:\rb\MyGate" -Force | Out-Null
    Write-Host "✅ Created C:\rb\MyGate"
}

# ── Pre-create codegen JNI dirs ───────────────────────────────────────────────
# The Android-autolinking.cmake references these paths. They must exist before CMake runs.
$baseNodeModules = "C:\Users\akash\Downloads\ritgate-main\ritgate-main\frontend\node_modules"
$baseRb = "C:\rb\MyGate"

$dirs = @(
    # Long paths (referenced by autolinking cmake)
    "$baseNodeModules\@react-native-async-storage\async-storage\android\build\generated\source\codegen\jni",
    "$baseNodeModules\@react-native-community\datetimepicker\android\build\generated\source\codegen\jni",
    "$baseNodeModules\react-native-gesture-handler\android\build\generated\source\codegen\jni",
    "$baseNodeModules\react-native-screens\android\build\generated\source\codegen\jni",
    "$baseNodeModules\react-native-safe-area-context\android\build\generated\source\codegen\jni",
    "$baseNodeModules\react-native-svg\android\build\generated\source\codegen\jni",
    # Redirected build dirs
    "$baseRb\react-native-async-storage_async-storage\generated\source\codegen\jni",
    "$baseRb\react-native-community_datetimepicker\generated\source\codegen\jni",
    "$baseRb\react-native-gesture-handler\generated\source\codegen\jni",
    "$baseRb\react-native-screens\generated\source\codegen\jni",
    "$baseRb\react-native-safe-area-context\generated\source\codegen\jni",
    "$baseRb\react-native-svg\generated\source\codegen\jni",
    "$baseRb\app\generated\source\codegen\jni",
    "$baseRb\app\generated\autolinking\src\main\jni"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created: $dir"
    }
}

Write-Host ""
Write-Host "✅ All dirs ready."
Write-Host ""
Write-Host "Now build from C:\rg\android:"
Write-Host "  cd C:\rg\android"
Write-Host "  .\gradlew assembleRelease"
