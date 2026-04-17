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

### Step 15: Verify Everything — DONE

**On the server — all checks passed:**
- `hostname` → `PHOENIX-SVR`
- `node --version` → `v20.18.1`
- `npm --version` → `10.8.2`
- `psql --version` → PostgreSQL 15
- `git --version` → Git installed
- `ssh Administrator@localhost` → SSH login successful
- `tailscale status` → 4 devices online (server, desktop, laptop, phone)
- All services running: PhoenixBackend, PhoenixNginx, postgresql-x64-15, sshd, Tailscale (all `Running` + `Automatic`)
- `Invoke-WebRequest http://localhost:5000` → `200 OK` — "Inventory API Running"
- `Invoke-WebRequest http://localhost` → `200 OK` — serves React HTML

**From laptop — verified:**
- Browser: `http://100.119.90.5` → Phoenix Inventory login page loads
- Terminal: `ssh Administrator@100.119.90.5` → SSH connects

**Tailscale network:**
```
100.119.90.5    phoenix-svr      (server)
100.112.110.39  desktop-d2ltv44  (home PC)
100.78.84.3     laptop-3mji9uge  (laptop)
100.91.255.44   xiaomi-15-ultra  (phone)
```

---

### Step 16: GitHub Actions Auto-Deploy — DONE

Because GitHub Actions runners are cloud-based (Azure) and the server is only reachable via Tailscale, the deploy workflow joins the Tailscale network temporarily using an auth key, then SSHs into the server as the `deploy` user.

**Phase 1: Retrieve deploy user's SSH private key — DONE**
```powershell
type C:\Users\deploy\.ssh\deploy_key
```
Private key copied, starts with `-----BEGIN OPENSSH PRIVATE KEY-----`.

**Important:** When pasting the key into GitHub Secrets, copy from Notepad (not PowerShell terminal) to avoid invisible character issues. Open the key in Notepad first:
```powershell
notepad C:\Users\deploy\.ssh\deploy_key
```
Then Ctrl+A, Ctrl+C, paste into GitHub.

**Phase 2: Generate Tailscale auth key — DONE**
- Went to `https://login.tailscale.com/admin/settings/keys`
- Generated with: Reusable ON, Ephemeral ON, 90-day expiration, Tags OFF
- Key format: `tskey-auth-...`
- **Note:** This key expires after 90 days. Regenerate and update the `TS_AUTHKEY` GitHub Secret before expiry.

**Phase 3: Add GitHub Secrets — DONE**
At `https://github.com/HIRAKHANJI/phoenix-inventory/settings/secrets/actions`:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | `100.119.90.5` |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | Full private key (BEGIN/END lines included) |
| `TS_AUTHKEY` | Tailscale auth key from Phase 2 |

**Phase 4: Deploy workflow file — DONE**

Created `.github/workflows/deploy.yml`. The workflow:
1. Triggers on every push to `main`
2. Checks out repo
3. Connects to Tailscale using `TS_AUTHKEY` (ephemeral node, auto-removes after run)
4. Waits 5s for Tailscale network to settle
5. SSHs to `deploy@100.119.90.5` using `SERVER_SSH_KEY`
6. Runs `powershell -ExecutionPolicy Bypass -File C:\phoenix-inventory\deploy.ps1`
7. `deploy.ps1` pulls code, installs deps, runs migrations, builds frontend, restarts services
8. `concurrency` group ensures only one deploy runs at a time

**Phase 5: First deploy test — DONE**

- Merged PR #3 (`claude/git-author-setup-IoSrq`) into `main`
- Initial run failed: `ssh: no key found` — caused by invisible characters from RDP clipboard copy
- Fixed by copying key from Notepad instead of PowerShell terminal
- Second run succeeded: **Deploy to Phoenix Server — 1m 19s**
- Verified on server: `git log -1` shows merged commit, both services running

---

## Issues Encountered During Setup

### Docker Desktop couldn't install (Step 3)
**Problem:** Docker Desktop installer said Windows Server 2019 is too old. Docker Engine installed but could only run Windows containers, not Linux.

**Solution:** Abandoned Docker entirely. Went with native installs: Node.js + PostgreSQL + Nginx directly on Windows, using NSSM to manage them as Windows services.

### Hyper-V install triggered multiple reboots (Step 3)
**Problem:** After each restart, the HP ProLiant G9 boot menu appeared asking to select boot device.

**Solution:** Select **RAID 1 (931.48 GiB)** at each boot menu. Can be disabled in BIOS later to boot directly to Windows.

### `winget` package manager not pre-installed on Server 2019 (Step 7)
**Problem:** Couldn't use `winget install` for Git.

**Solution:** Downloaded Git installer directly via `Invoke-WebRequest` and installed with `/VERYSILENT`.

### `ssh-keygen -N ""` flag not accepted by Windows OpenSSH 7.7 (Step 9)
**Problem:** Windows version of `ssh-keygen` rejected the empty-quote passphrase argument.

**Solution:** Run `ssh-keygen -t ed25519 -f <path>` without `-N`, then hit Enter twice interactively when prompted for passphrase.

### SSH key auth failed for deploy user (Step 9)
**Problem:** The deploy user kept being asked for a password despite a correct key file being in `~/.ssh/authorized_keys`.

**Solution:** On Windows, administrator accounts don't use `~/.ssh/authorized_keys` — they use `C:\ProgramData\ssh\administrators_authorized_keys` instead. Needed to:
1. Copy the public key there (not append)
2. Set strict permissions: `icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "SYSTEM:F" /grant "Administrators:F"`
3. Uncomment `PubkeyAuthentication yes` in `C:\ProgramData\ssh\sshd_config`
4. Restart sshd service

### Deploy user password rejection (Step 8)
**Problem:** `net user deploy <password>` kept failing with "does not meet password policy requirements."

**Solution:** Password needed uppercase + lowercase + number + special character. `Ph03n1x_5VR!` worked.

### Knex migrations failed on production env (Step 10)
**Problem:** `npx knex migrate:latest` errored with "Unable to acquire a connection."

**Cause:** `knexfile.js` production config uses `process.env.DATABASE_URL` which wasn't set. The separate `DB_HOST`, `DB_USER`, etc. env vars are only used in the development config.

**Solution:** Ran migrations using `--env development` flag which uses the individual DB_* env vars from `.env`:
```powershell
npx knex migrate:latest --env development
npx knex seed:run --env development
```

### `.env.example` in wrong location (Step 10)
**Problem:** `Copy-Item .env.example .env` inside `backend/` folder failed — file didn't exist there.

**Solution:** `.env.example` is at the repo root, not in `backend/`. Copied from the correct location:
```powershell
Copy-Item C:\phoenix-inventory\.env.example C:\phoenix-inventory\backend\.env
```

### Node.js version warning during frontend build (Step 10)
**Problem:** `npm run build` warned that Vite requires Node.js 20.19+ (installed was 20.18.1).

**Solution:** Build still succeeded despite the warning. Kept Node.js 20.18.1 for now — upgrade to 20.19+ later if dependency issues arise.

### Nginx run from wrong directory (Step 11)
**Problem:** Running `.\nginx.exe -t` from `C:\phoenix-inventory\frontend` caused nginx to look for config in the wrong place.

**Solution:** Always `cd C:\nginx` before running nginx commands. NSSM service config handles this automatically via `AppDirectory`.

### RDP failed to Microsoft-account-linked Windows 11 PC (personal PC setup)
**Problem:** Couldn't RDP to personal PC using the Microsoft account email/password — kept failing.

**Cause:** Windows 11 with Microsoft account uses Windows Hello PIN by default. RDP requires the Microsoft account password to be cached locally.

**Solution:** On personal PC, locked screen (Win+L), clicked "Sign-in options", selected key icon, typed full Microsoft account password (not PIN). This cached it locally. Then RDP worked with email + password.

### Auto-login + security tradeoffs
**Problem:** Without auto-login, reboots would lock the server remotely (Tailscale still works but RDP session gets stuck).

**Solution:** Enabled auto-login (registry), but paired with immediate auto-lock (scheduled task) so anyone physically at the server sees a locked screen. Also restricted RDP to Tailscale network only — outside devices can't even attempt to connect.

---

## Current Server Capabilities (as of 2026-04-17)

- App accessible via Tailscale IP at `http://100.119.90.5` (devices on Tailscale network only)
- App accessible via LAN IP at `http://192.168.x.x` (devices on same local network as server)
- NOT accessible from the public internet (no domain, no port forwarding, no HTTPS)
- Auto-deploy on every push to `main` via GitHub Actions (~1-3 min deploy time)
- All services auto-start on boot, no physical login required
- RDP restricted to Tailscale network only
- Physical access blocked by auto-lock screen

---

## Future Setup Instructions

### Priority 1: Static IP (when server moves to permanent router)

**When:** Before placing the server in the server rack with its permanent network connection.

**Why:** DHCP can change the server's LAN IP after a reboot. Static IP ensures the server is always reachable at the same LAN address.

**Steps:**

1. Find the new router's subnet info:
   - Log into the router admin page (usually `192.168.1.1` or `192.168.0.1` in a browser)
   - Note the subnet range (e.g., `192.168.1.x`)
   - Pick an IP outside the DHCP range (e.g., `192.168.1.100`) — check the router's DHCP settings to see the range

2. On the server:
   - Server Manager > Local Server > Ethernet > click the network adapter link
   - Right-click adapter > Properties > Internet Protocol Version 4 (TCP/IPv4) > Properties
   - Select **"Use the following IP address"**
   - **IP address**: `192.168.1.100` (or your chosen address)
   - **Subnet mask**: `255.255.255.0`
   - **Default gateway**: `192.168.1.1` (your router's IP)
   - Select **"Use the following DNS server addresses"**
   - **Preferred DNS**: `8.8.8.8`
   - **Alternate DNS**: `8.8.4.4`
   - Click OK, close

3. Verify internet still works:
   ```powershell
   Test-NetConnection -ComputerName google.com -Port 443
   ```

4. The `SERVER_HOST` GitHub Secret uses the Tailscale IP (`100.119.90.5`) — this does NOT change when you set a static LAN IP, so no update needed there.

5. For LAN users who accessed the app via the old DHCP IP, share the new static IP.

---

### Priority 2: HTTPS/SSL with Domain via Cloudflare

**When:** When the server has its permanent internet connection and static IP, and you want the app accessible from the public internet.

**Why:** HTTPS encrypts traffic, a domain name gives a professional URL, and Cloudflare provides free SSL, DDoS protection, and DNS management.

**What you need:**
- A domain name (~$10/year from Cloudflare Registrar, Namecheap, or Porkbun)
- A Cloudflare account (free)
- Your public IP address (run `curl ifconfig.me` from the server, or Google "what is my IP")

**Steps:**

1. **Buy a domain** (e.g., `phoenixinventory.com` or `phoenix-systems.com`):
   - Go to `https://www.cloudflare.com/products/registrar/`
   - Search for an available domain
   - Purchase it (~$10/year)

2. **Add the domain to Cloudflare** (if bought elsewhere):
   - Log into Cloudflare dashboard
   - Click "Add a site" → enter your domain
   - Select Free plan
   - Update nameservers at your registrar to the ones Cloudflare provides

3. **Create a DNS A record**:
   - In Cloudflare DNS settings for your domain
   - Type: **A**
   - Name: `@` (root domain) or `inventory` (for a subdomain like `inventory.yourdomain.com`)
   - Content: your **public IP address**
   - Proxy status: **Proxied** (orange cloud ON) — this gives you free SSL

4. **Set up port forwarding on your router**:
   - Log into router admin
   - Forward **port 80** (HTTP) → server's static LAN IP (e.g., `192.168.1.100`) port 80
   - Forward **port 443** (HTTPS) → server's static LAN IP port 443
   - Cloudflare handles SSL termination, so Nginx still serves on port 80

5. **Configure Cloudflare SSL**:
   - In Cloudflare dashboard > SSL/TLS
   - Set mode to **"Flexible"** (Cloudflare handles HTTPS to visitors, talks HTTP to your server)
   - This means you do NOT need to install an SSL certificate on the server

6. **Update Nginx config** (on the server):
   ```powershell
   notepad C:\nginx\conf\nginx.conf
   ```
   Change `server_name localhost;` to `server_name yourdomain.com;` (your actual domain)
   
   Then restart Nginx:
   ```powershell
   nssm restart PhoenixNginx
   ```

7. **Update frontend API URL**:
   - The frontend's `axios.js` has `http://localhost:5000/api` hardcoded
   - With Nginx proxying `/api` to the backend, the frontend should use relative URLs
   - This may require a code change: `baseURL` should be `/api` instead of `http://localhost:5000/api`

8. **Test**: Open `https://yourdomain.com` in a browser from any device, anywhere

**Result:** App accessible at `https://yourdomain.com` from any device in the world, with free SSL from Cloudflare.

---

### Priority 3: Real Test Coverage

**When:** Before relying on CI status checks to gate PRs.

**Why:** Both backend and frontend currently have only dummy tests (`expect(true).toBe(true)`). CI passes but catches nothing. Critical business logic (stock movements, auth, cascading deletes) has zero automated validation.

**What needs testing:**

**Backend (Jest + Supertest):**
- Auth endpoints: register, login, duplicate email rejection, JWT validation
- Product CRUD: create, read, update, delete, cascading stock deletion
- Stock operations: inbound, outbound, prevent negative stock, deduplication
- User management: role changes, status changes, permission enforcement
- Multi-tenant isolation: ensure Phoenix data doesn't leak to Inpack

**Frontend (Vitest + React Testing Library):**
- Login/Register forms: validation, submission, error handling
- Admin pages: product list rendering, stock table rendering
- API calls: mock axios responses, verify correct endpoints called
- Route protection: unauthenticated redirect, role-based access

**How to start:**
1. Create backend test setup with test database
2. Write tests for auth endpoints first (highest risk)
3. Write tests for stock operations (most complex)
4. Enable the CI "Require status checks to pass" branch protection rule once tests are meaningful

---

### Priority 4: IMPACK → INPACK Code Refactor

> **NOTE:** Remove this section from SERVER_SETUP.md once the refactor is completed, as it is a codebase task not a server setup task.

**When:** Next available code cleanup session.

**Why:** The company is called "Inpack" but the codebase inconsistently uses "impack" in variable names, env vars, and config. The database on the server is already named `inpack_db` (correct). The code needs to match.

**What needs changing:**
- `backend/src/config/dbManager.js`: `impackPool` → `inpackPool`, `IMPACK_DB` → `INPACK_DB`
- `backend/.env.example`: `IMPACK_DB` → `INPACK_DB`
- `backend/src/config/env.js`: any `impack` references
- `backend/scripts/seed_impack.js`: rename file and internal references
- `backend/scripts/schema_clone.js`: `impack` references
- Frontend display text: verify "Inpack" is used consistently (not "Impack")
- `ARCHITECTURE.md`: `INPACK_DB` reference in Mermaid diagram
- Server `.env` file: update `IMPACK_DB=inpack_db` to `INPACK_DB=inpack_db` after code change

**After refactor:** Update the server's `.env` file:
```powershell
notepad C:\phoenix-inventory\backend\.env
```
Change `IMPACK_DB=inpack_db` to `INPACK_DB=inpack_db`. The deploy script will pull the code changes, but the `.env` must be manually updated since it's not in the repo.

---

### Priority 5: CLAUDE.md

> **NOTE:** Remove this section from SERVER_SETUP.md once CLAUDE.md is committed to the repo, as it is a project governance file not a server setup task.

**When:** Next session focused on codebase maintenance.

**Why:** CLAUDE.md provides rules and context for AI assistants (Claude Code) and contributors working on the repo. It documents the architecture, known issues, coding standards, and priority order for improvements.

**What it contains (proposed):**
- Project overview and tech stack
- Full directory structure with notes on dead code (unused services/repositories layers)
- Multi-tenancy architecture explanation
- Auth flow documentation
- Database access pattern (controllers use raw SQL, bypass services layer)
- All 20+ known issues prioritized (schema mismatches, missing deps, security gaps)
- Complete API endpoint reference including broken frontend calls
- Database schema: what exists vs what's missing from migrations
- Rules for AI assistants and contributors (git workflow, code standards, checklists)
- Environment variables reference

**Status:** Full content drafted and reviewed. Ready to commit when approved.

---

## Maintenance Notes

### Tailscale Auth Key Expiry
The `TS_AUTHKEY` GitHub Secret expires after **90 days** from creation. Before it expires:
1. Go to `https://login.tailscale.com/admin/settings/keys`
2. Generate a new auth key (Reusable ON, Ephemeral ON, 90 days, Tags OFF)
3. Update the `TS_AUTHKEY` secret at `https://github.com/HIRAKHANJI/phoenix-inventory/settings/secrets/actions`

### Node.js Upgrade (when needed)
Current: v20.18.1. Some dependencies warn about needing 20.19+. When builds start failing:
```powershell
Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi" -OutFile node-upgrade.msi
msiexec /i node-upgrade.msi /qn
```
Close and reopen PowerShell, verify with `node --version`, then restart the backend service:
```powershell
nssm restart PhoenixBackend
```

### knexfile.js Production Config
Migrations currently run with `--env development` because the production config requires `DATABASE_URL` which isn't set. To fix permanently, either:
- Add `DATABASE_URL=postgresql://postgres:<password>@localhost:5432/inventory_system` to `.env`
- Or update `knexfile.js` production section to use individual `DB_*` vars like development does

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
