# PokéRogue 局域网联机启动脚本
# 同时启动 LAN 服务器 + 游戏

Write-Host "=== PokéRogue 局域网联机 ===" -ForegroundColor Green

# 1. 启动 LAN 服务器（后台）
Write-Host ""
Write-Host "[1/2] 启动 LAN 服务器..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\pokeregue\pokerogue; Write-Host '=== LAN 服务器 (端口 9090) ===' -ForegroundColor Yellow; node scripts/lan-server.mjs"

Write-Host "[2/2] 启动游戏..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

# 2. 启动游戏
npx vite --mode development --open

Write-Host ""
Write-Host "=== 启动完成 ===" -ForegroundColor Green
Write-Host "Host: 主菜单 -> 局域网联机 -> 创建房间"
Write-Host "你的局域网 IP:" -NoNewline
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -like "192.168.*" } | Select-Object -ExpandProperty IPAddress
