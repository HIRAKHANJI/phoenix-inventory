# Phoenix Inventory: Native Windows Deployment Script
# 
# This script automates production deployment for Windows Server 2019/2022
# without requiring Docker. It uses PM2 for process management.
#
# Requirements: Git, Node.js 20+, PM2 (npm install -g pm2), PostgreSQL 15

$ErrorActionPreference = "Stop"

Write-Host "--- Phoenix Inventory: Native Windows Deployment ---" -ForegroundColor Cyan

# 1. Verification of Requirements
Write-Host "[1/6] Verifying Runtime Environment..." -ForegroundColor Yellow
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Error "PM2 not found. Please install with: npm install -g pm2"
    exit 1
}

# 2. Update Source Code
Write-Host "[2/6] Synchronizing Repository..." -ForegroundColor Yellow
git pull origin main

# 3. Update Dependencies
Write-Host "[3/6] Installing Backend Dependencies..." -ForegroundColor Yellow
cd backend
npm install --production

Write-Host "[3.1/6] Installing Frontend Dependencies..." -ForegroundColor Yellow
cd ../frontend
npm install

# 4. Database Schema Update
Write-Host "[4/6] Executing Database Migrations..." -ForegroundColor Yellow
cd ../backend
npx knex migrate:latest

# 5. Build Frontend
Write-Host "[5/6] Building Production UI..." -ForegroundColor Yellow
cd ../frontend
npm run build

# 6. Restart Application Service
Write-Host "[6/6] Restarting Phoenix Service..." -ForegroundColor Yellow
cd ../backend

# Check if pm2 process exists
$pm2Status = pm2 list | Select-String "phoenix-backend"
if ($pm2Status) {
    pm2 reload "phoenix-backend"
} else {
    pm2 start src/server.js --name "phoenix-backend"
}

pm2 save

Write-Host "`nDeployment Complete! Service is live and managed by PM2." -ForegroundColor Green
Write-Host "Use 'pm2 list' or 'pm2 logs' to monitor." -ForegroundColor Cyan
