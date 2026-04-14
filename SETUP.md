# Phoenix Inventory: Deployment & Setup Guide

This guide provides step-by-step instructions for setting up the Phoenix Inventory system in both development and production environments, with a primary focus on **Windows Server 2019**.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Database Setup (PostgreSQL 15)](#2-database-setup-postgresql-15)
3. [Native Windows Server Production Setup](#3-native-windows-server-production-setup)
4. [Docker Setup (Development)](#4-docker-setup-development)
5. [Connecting via IP Address](#5-connecting-via-ip-address)
6. [Post-Installation Verification](#6-post-installation-verification)

---

## 1. Prerequisites

### 1.1. Core Software
- **Node.js 20.x (LTS)**: [Download for Windows](https://nodejs.org/en/download)
- **Git**: [Download for Windows](https://git-scm.com/download/win)
- **PostgreSQL 15**: [Interactive Installer](https://www.postgresql.org/download/windows/)

### 1.2. Process Manager (PM2)
Essential for keeping the app running after terminal sessions end.
```powershell
npm install -g pm2
```

---

## 2. Database Setup (PostgreSQL 15)

### 2.1. Native Installation
1. Run the PostgreSQL installer.
2. During setup, choose a "Superuser" password (default: `root` or `postgres`).
3. Set the port to `5432`.

### 2.2. Initialize Database
Open **pgAdmin 4** or use the `psql` command line:
```sql
CREATE DATABASE inventory_system;
```

---

## 3. Native Windows Server Production Setup

This is the recommended path for servers without Docker.

### 3.1. Repository Configuration
```powershell
git clone [your-repo-url]
cd inventory-system
```

### 3.2. Environment Setup
Copy the example file and update it with your server's credentials:
```powershell
copy .env.example backend\.env
```
Edit `backend\.env`:
- `DB_HOST=localhost`
- `DB_NAME=inventory_system`
- `DB_PASSWORD=your_postgres_password`
- `JWT_SECRET=your_secure_random_string`
- `PORT=5000`

### 3.3. Backend Deployment
```powershell
cd backend
npm install --production
npx knex migrate:latest
pm2 start src/server.js --name "phoenix-backend"
```

### 3.4. Frontend Deployment
The frontend is built as static files and can be served using Node.js or a simple Nginx Windows service.
```powershell
cd ../frontend
npm install
npm run build
```

---

## 4. Docker Setup (Development)

If you decide to enable Docker on your Windows Server later:
```powershell
docker-compose up -d --build
```

---

## 5. Connecting via IP Address

To allow other computers on your network to access the system:

1.  **Open Windows Firewall**:
    - Go to `Windows Defender Firewall with Advanced Security`.
    - Create a new **Inbound Rule** for Port `5000` (Backend) and Port `80/5173` (Frontend).
2.  **Access URL**:
    - Users can access the app via: `http://[YOUR_SERVER_IP]:5173` (Dev) or `http://[YOUR_SERVER_IP]:80` (Standard).

---

## 6. Post-Installation Verification

Run the following to ensure everything is operational:

### 6.1. Logic Verification
```powershell
cd backend
npm test
```

### 6.2. Process Monitoring
```powershell
pm2 list
pm2 logs phoenix-backend
```

---
> **Industry Tip**: For maximum performance on Windows Server 2019, ensure your `Power Plan` is set to `High Performance` in the Windows Control Panel to prevent the CPU from throttling during database operations.
