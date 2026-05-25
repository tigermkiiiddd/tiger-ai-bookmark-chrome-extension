# Chrome Extension Validation Script
# 验证Chrome扩展构建的完整性

Write-Host "🔍 验证Chrome扩展构建..." -ForegroundColor Blue

# 检查必需文件
$requiredFiles = @(
    "dist/manifest.json",
    "dist/background.js", 
    "dist/content.js",
    "dist/popup/index.html",
    "dist/options/index.html",
    "dist/icons/icon16.png",
    "dist/icons/icon32.png",
    "dist/icons/icon48.png",
    "dist/icons/icon128.png"
)

$missingFiles = @()
$foundFiles = @()

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $foundFiles += $file
        Write-Host "✅ 找到文件: $file" -ForegroundColor Green
    } else {
        $missingFiles += $file
        Write-Host "❌ 缺少文件: $file" -ForegroundColor Red
    }
}

# 总结
Write-Host "据总结:" -ForegroundColor Blue
Write-Host "找到文件: $($foundFiles.Count)/$($requiredFiles.Count)" -ForegroundColor White

if ($missingFiles.Count -eq 0) {
    Write-Host "🎉 所有必需文件验证通过！" -ForegroundColor Green
    Write-Host "Chrome扩展已准备就绪，可以在Chrome中加载！" -ForegroundColor Green
} else {
    Write-Host "❌ 验证失败，缺少 $($missingFiles.Count) 个文件!" -ForegroundColor Red
}