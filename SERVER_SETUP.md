# Server Setup Guide — Phoenix Inventory System

## Server Hardware

- **Model**: HP ProLiant DL360 G9
- **CPU**: 2x Intel Xeon E5-2643 v4 (12 cores / 24 threads)
- **RAM**: 16GB DDR4
- **Storage**: 1TB SSD (RAID 1)
- **PSU**: 2x 400W (redundant)
- **OS**: Windows Server 2019

## Server Identity

- **Hostname**: `PHOENIX-SVR`
- **Tailscale IP**: `100.119.90.5` (fixed, works from anywhere)
- **LAN IP**: DHCP (temporary) — static IP to be set when moved to permanent router

---

## Access Methods

| Method | Address | Username | From Where |
|--------|---------|----------|------------|
| **RDP (GUI)** | `mstsc /v:100.119.90.5` | `PHOENIX-SVR\Administrator` | Anywhere (Tailscale only) |
| **SSH (CLI)** | `ssh Administrator@100.119.90.5` | `Administrator` | Anywhere |
| **App (Browser)** | `http://100.119.90.5` | N/A | Anywhere via Tailscale |
| **App (LAN)** | `http://192.168.x.x` | N/A | Same network only |

---

## Services Running on Boot (No Login Required)

| Service | Type | Auto-Starts | What It Does |
|---------|------|------------|--------------|
| **Tailscale** | Windows Service | Yes | VPN tunnel — RDP/SSH accessible immediately on boot |
| **postgresql-x64-15** | Windows Service | Yes | PostgreSQL 15 database on port 5432 |
| **PhoenixBackend** | NSSM Service | Yes | Node.js Express API on port 5000 |
| **PhoenixNginx** | NSSM Service | Yes | Nginx serving frontend on port 80, proxying /api to backend |
| **sshd** | Windows Service | Yes | OpenSSH server for remote CLI access and GitHub Actions deploy |
| **Auto-login** | Registry | Yes | Logs in as Administrator automatically |
| **AutoLockAfterLogin** | Scheduled Task | Yes | Locks screen immediately after auto-login |

**Boot sequence**: Power on → Windows boots → Auto-logs in as Administrator → Screen locks immediately → All services start → App is live → RDP/SSH accessible via Tailscale.

---

## Security Configuration

- **RDP**: Blocked from all networks EXCEPT Tailscale (`100.64.0.0/10`)
- **Auto-login**: Enabled so services start properly on reboot without physical access
- **Auto-lock**: Screen locks immediately after login — physical access requires password
- **Screen timeout**: Monitor turns off after 1 minute of inactivity
- **SSH key auth**: Deploy user authenticates via ED25519 key (no password)
- **Firewall**: Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 5000 (API) open

---

## Setup Steps Completed

### Step 1: Basic Server Setup

**1a. Static IP — PENDING**
- Server is currently on DHCP (temporary LAN connection)
- When moved to permanent router, set static IP:
  - Server Manager > Local Server > Ethernet > right-click adapter > Properties > IPv4
  - Change from "Obtain an IP address automatically" to "Use the following IP address"
  - Set IP matching the new router's subnet (e.g., `192.168.1.100`)
  - Subnet mask: `255.255.255.0`
  - Default gateway: router's IP (e.g., `192.168.1.1`)
  - DNS: `8.8.8.8` (primary), `8.8.4.4` (secondary)
- Then update `SERVER_HOST` GitHub Secret if using LAN IP

**1b. Rename Server — DONE**
- Server Manager > Local Server > Computer Name > Change
- Set to `PHOENIX-SVR`
- Required restart

**1c. Enable Remote Desktop — DONE**
- Server Manager > Local Server > Remote Desktop > Enabled
- Network Level Authentication (NLA) enabled

---

### Step 2: Install Tailscale — DONE

Tailscale creates an encrypted VPN between devices. No port forwarding needed.

**On the server (PowerShell as Admin):**
```powershell
Invoke-WebRequest -UseBasicParsing "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" -OutFile tailscale-setup.exe
.\tailscale-setup.exe /quiet
```
- Signed in via GitHub account (HIRAKHANJI)
- Server Tailscale IP: `100.119.90.5`

**On the laptop:**
```powershell
winget install --id Tailscale.Tailscale -e
```
- Signed in with same GitHub account

**Verified auto-start on boot:**
```powershell
Set-Service -Name "Tailscale" -StartupType Automatic
```

---

### Step 3: Remove Docker — DONE

Docker Desktop doesn't support Windows Server 2019. Docker Engine only runs Windows containers. App needs Linux containers. Removed Docker entirely.

```powershell
Stop-Service docker -Force -ErrorAction SilentlyContinue
dockerd --unregister-service
Remove-Item "$env:ProgramFiles\docker" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:ProgramData\docker" -Recurse -Force -ErrorAction SilentlyContinue
```

---

### Step 4: Install Node.js — DONE

```powershell
Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi" -OutFile node-installer.msi
msiexec /i node-installer.msi /qn
```

- Version: v20.18.1
- npm: 10.8.2
- Note: Some frontend dependencies warn about needing 20.19+, but everything builds and runs fine

---

### Step 5: Install PostgreSQL — DONE

```powershell
Invoke-WebRequest -UseBasicParsing "https://get.enterprisedb.com/postgresql/postgresql-15.10-1-windows-x64.exe" -OutFile pg-installer.exe
.\pg-installer.exe
```

- Installed: PostgreSQL Server, pgAdmin 4, Command Line Tools
- Port: 5432
- Auto-starts as Windows service

**Added to PATH:**
```powershell
[Environment]::SetEnvironmentVariable("Path", "$env:Path;C:\Program Files\PostgreSQL\15\bin", [EnvironmentVariableTarget]::Machine)
```

**Databases created:**
```powershell
psql -U postgres -c "CREATE DATABASE inventory_system;"
psql -U postgres -c "CREATE DATABASE inpack_db;"
```

| Database | Purpose |
|----------|---------|
| `inventory_system` | Phoenix company data |
| `inpack_db` | Inpack company data |

**Note:** The codebase uses `IMPACK_DB` as the env var name but the actual database is `inpack_db`. A code refactor to standardize naming is planned.

---

### Step 6: Install OpenSSH Server — DONE

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

**sshd_config modified** (`C:\ProgramData\ssh\sshd_config`):
- `PubkeyAuthentication yes` (uncommented)
- `Match Group administrators` block uses `__PROGRAMDATA__/ssh/administrators_authorized_keys`

---

### Step 6.5: Security Hardening — DONE

**Changed Administrator password:**
```powershell
net user Administrator <new-password>
```

**Auto-login enabled (survives reboots):**
```powershell
$RegPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty -Path $RegPath -Name "AutoAdminLogon" -Value "1"
Set-ItemProperty -Path $RegPath -Name "DefaultUserName" -Value "Administrator"
Set-ItemProperty -Path $RegPath -Name "DefaultPassword" -Value "<password>"
Set-ItemProperty -Path $RegPath -Name "DefaultDomainName" -Value "PHOENIX-SVR"
```

**Auto-lock after login (blocks physical access):**
```powershell
$Action = New-ScheduledTaskAction -Execute "rundll32.exe" -Argument "user32.dll,LockWorkStation"
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries
$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings
Register-ScheduledTask -TaskName "AutoLockAfterLogin" -InputObject $Task -Force
```

**Screen timeout:**
```powershell
powercfg /change monitor-timeout-ac 1
```

**RDP restricted to Tailscale only:**
```powershell
Disable-NetFirewallRule -DisplayGroup "Remote Desktop"
New-NetFirewallRule -DisplayName "RDP via Tailscale Only" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow -RemoteAddress 100.64.0.0/10
```

---

### Step 7: Install Git — DONE

```powershell
Invoke-WebRequest -UseBasicParsing "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -OutFile git-installer.exe
.\git-installer.exe /VERYSILENT
```

---

### Step 8: Create Deploy User — DONE

```powershell
net user deploy <password> /add
net localgroup Administrators deploy /add
```

This user is exclusively for GitHub Actions SSH deployments. The Administrator account stays separate.

---

### Step 9: Generate SSH Key Pair — DONE

```powershell
runas /user:deploy "cmd /c echo profile created"
mkdir C:\Users\deploy\.ssh
ssh-keygen -t ed25519 -f C:\Users\deploy\.ssh\deploy_key
```

- Passphrase: none (empty)
- Public key copied to: `C:\ProgramData\ssh\administrators_authorized_keys`
- Permissions set:
  ```powershell
  icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "SYSTEM:F" /grant "Administrators:F"
  ```
- Private key saved for GitHub Secrets (`SERVER_SSH_KEY`)

**Verified key-based SSH login works:**
```powershell
ssh -i C:\Users\deploy\.ssh\deploy_key deploy@localhost
```

---

### Step 10: Clone Repo and Set Up App — DONE

```powershell
mkdir C:\phoenix-inventory
cd C:\phoenix-inventory
git clone https://github.com/HIRAKHANJI/phoenix-inventory.git .
```

**Backend setup:**
```powershell
cd C:\phoenix-inventory\backend
npm install
Copy-Item C:\phoenix-inventory\.env.example C:\phoenix-inventory\backend\.env
```

**`.env` configured** (`C:\phoenix-inventory\backend\.env`):
```env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=<postgres-password>
DB_PORT=5432
PHOENIX_DB=inventory_system
IMPACK_DB=inpack_db
JWT_SECRET=<generated-base64-string>
JWT_REFRESH_SECRET=<generated-base64-string>
```

JWT secrets generated with:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
```

**Migrations and seeds run (using development config since production requires DATABASE_URL):**
```powershell
npx knex migrate:latest --env development
npx knex seed:run --env development
```

- 6 migrations ran successfully
- 2 seed files ran (super admin + initial data)
- Default super admin: `superadmin@phoenic-pack.com`

**Frontend build:**
```powershell
cd C:\phoenix-inventory\frontend
npm install
npm run build
```

Build output in `C:\phoenix-inventory\frontend\dist\`

---

### Step 11: Install Nginx — DONE

```powershell
Invoke-WebRequest -UseBasicParsing "https://nginx.org/download/nginx-1.26.2.zip" -OutFile nginx.zip
Expand-Archive nginx.zip -DestinationPath C:\ -Force
Rename-Item "C:\nginx-1.26.2" "C:\nginx"
```

**Nginx config** (`C:\nginx\conf\nginx.conf`):
```nginx
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;

    server {
        listen 80;
        server_name localhost;
        root C:/phoenix-inventory/frontend/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

- Port 80: serves React frontend static files
- `/api` requests proxied to Node.js backend on port 5000
- SPA routing: `try_files` falls back to `index.html`

---

### Step 12: Create Windows Services — DONE

**Installed NSSM (Non-Sucking Service Manager):**
```powershell
Invoke-WebRequest -UseBasicParsing "https://nssm.cc/release/nssm-2.24.zip" -OutFile nssm.zip
Expand-Archive nssm.zip -DestinationPath C:\ -Force
Copy-Item "C:\nssm-2.24\win64\nssm.exe" "C:\Windows\System32\nssm.exe"
```

**PhoenixBackend service:**
```powershell
nssm install PhoenixBackend "C:\Program Files\nodejs\node.exe"
nssm set PhoenixBackend AppParameters "C:\phoenix-inventory\backend\src\server.js"
nssm set PhoenixBackend AppDirectory "C:\phoenix-inventory\backend"
nssm set PhoenixBackend AppStdout "C:\phoenix-inventory\backend\logs\service-out.log"
nssm set PhoenixBackend AppStderr "C:\phoenix-inventory\backend\logs\service-err.log"
nssm set PhoenixBackend AppEnvironmentExtra "NODE_ENV=production"
nssm set PhoenixBackend Start SERVICE_AUTO_START
nssm set PhoenixBackend AppStopMethodSkip 0
nssm set PhoenixBackend AppStopMethodConsole 5000
nssm set PhoenixBackend AppStopMethodWindow 5000
nssm set PhoenixBackend AppStopMethodThreads 5000
```

**PhoenixNginx service:**
```powershell
nssm install PhoenixNginx "C:\nginx\nginx.exe"
nssm set PhoenixNginx AppDirectory "C:\nginx"
nssm set PhoenixNginx Start SERVICE_AUTO_START
nssm set PhoenixNginx AppStopMethodSkip 6
nssm set PhoenixNginx AppStopMethodConsole 3000
```

**Verified all services:**
```
PhoenixBackend    Running Automatic
PhoenixNginx      Running Automatic
postgresql-x64-15 Running Automatic
sshd              Running Automatic
Tailscale         Running Automatic
```

---

### Step 13: Create Deploy Script — DONE

**File**: `C:\phoenix-inventory\deploy.ps1`

```powershell
# deploy.ps1 — Graceful pull and restart

Write-Host "=== Pulling latest code ==="
cd C:\phoenix-inventory
git pull origin main

Write-Host "=== Installing backend dependencies ==="
cd C:\phoenix-inventory\backend
npm install --production

Write-Host "=== Running database migrations ==="
npx knex migrate:latest

Write-Host "=== Building frontend ==="
cd C:\phoenix-inventory\frontend
npm install
npm run build

Write-Host "=== Restarting backend (graceful) ==="
nssm restart PhoenixBackend

Write-Host "=== Restarting Nginx ==="
nssm restart PhoenixNginx

Write-Host "=== Deploy complete at $(Get-Date) ==="
```

GitHub Actions SSHs into the server and executes this script on every push to `main`.

---

### Step 14: Open Firewall Ports — DONE

```powershell
New-NetFirewallRule -DisplayName "SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "Backend API" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

RDP (port 3389) is restricted to Tailscale network only (configured in Step 6.5).

---

### Step 15: Verify Everything — TO DO

Run on the server:
```powershell
hostname
node --version
npm --version
psql --version
git --version
ssh localhost "echo SSH works"
tailscale status
Get-Service PhoenixBackend, PhoenixNginx, Tailscale, sshd, postgresql* | Select Name, Status, StartType
Invoke-WebRequest -Uri http://localhost:5000 -UseBasicParsing
Invoke-WebRequest -Uri http://localhost -UseBasicParsing
```

From laptop:
- Browser: `http://100.119.90.5` (should show login page)
- Terminal: `ssh Administrator@100.119.90.5` (should connect)

---

### Step 16: GitHub Actions Auto-Deploy — TO DO

**GitHub Secrets needed** (`Settings > Secrets and variables > Actions`):

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | `100.119.90.5` |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | Deploy user's private key (from Step 9) |

A `.github/workflows/deploy.yml` will be created to SSH into the server and run `deploy.ps1` on every push to `main`.

---

## Pending Items

1. **Static IP** — Set when server moves to permanent router location
2. **IMPACK/INPACK naming refactor** — Code uses `IMPACK_DB` env var but database is `inpack_db`
3. **knexfile.js production config** — Currently uses `DATABASE_URL` which isn't set; migrations run via `--env development`
4. **HTTPS/SSL** — Requires domain name + certificate (future)
5. **CLAUDE.md** — Project guidelines file for AI assistants and contributors (proposed, not yet created)

---

## Troubleshooting

### Service not starting
```powershell
nssm status PhoenixBackend
nssm restart PhoenixBackend
type C:\phoenix-inventory\backend\logs\service-err.log
```

### Database connection issues
```powershell
psql -U postgres -c "\l"
Get-Service postgresql*
```

### Nginx issues
```powershell
cd C:\nginx
.\nginx.exe -t
nssm restart PhoenixNginx
```

### Can't RDP after reboot
- Tailscale should auto-connect on boot (system service)
- Auto-login is enabled (no physical login needed)
- If stuck: need physical access to the server, login, check Tailscale tray icon

### SSH key not working for deploy user
- Key file: `C:\Users\deploy\.ssh\deploy_key`
- Authorized keys: `C:\ProgramData\ssh\administrators_authorized_keys`
- Check permissions: `icacls C:\ProgramData\ssh\administrators_authorized_keys`
- Restart SSH: `Restart-Service sshd`
