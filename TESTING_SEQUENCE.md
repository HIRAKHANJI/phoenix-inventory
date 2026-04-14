# Phoenix Inventory: Verification & Testing Sequence

This document outlines the systematic protocols for ensuring system stability, data integrity, and production readiness in both Docker and Native Windows environments.

---

## 1. Automated Testing Suite

We use **Jest** and **Supertest** for backend logic verification.

### 1.1. Core Test Components
- **Auth Integrity**: Verifies JWT issuance, password hashing, and role-based validation.
- **Stock Movement**: Checks if `IN` and `OUT` transactions accurately update inventory.
- **Deduplication**: Ensures SKU constraints work across both `stock` and `inventory` tables.
- **Cascading Integrity**: Confirms that deleting a product removes all associated warehouse records.

### 1.2. Running the Suite
```powershell
cd backend
npm test
```

---

## 2. Production Readiness Checklist (Windows Server 2019)

Use this checklist before going live on your server.

| Step | Action | Status |
| :--- | :--- | :--- |
| **1. Database** | PostgreSQL 15 installed and `inventory_system` created. | [ ] |
| **2. Config** | `.env` file populated with secure JWT and DB credentials. | [ ] |
| **3. Migrations** | `npx knex migrate:latest` executed successfully. | [ ] |
| **4. Process** | PM2 service active and `phoenix-backend` running. | [ ] |
| **5. Firewall** | Inbound rules for Port 5000 and 5173/80 enabled. | [ ] |
| **6. Build** | `npm run build` completed for the frontend. | [ ] |

---

## 3. GitHub & Local Testing Log

| Date | Verification Step | Tester | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-04-02 | Docker Architecture | Antigravity | [PASS] | Inter-container link verified. |
| 2026-04-14 | Native Windows Overhaul | Antigravity | [PASS] | Documentation & Native Script added. |
| 2026-04-14 | Auth Integration Tests | Antigravity | [PASS] | JWT/RBAC logic verified. |
| ... | ... | ... | ... | ... |

---

## 4. Manual UI Verification Protocol

Perform these steps on the staging server before final release:

1.  **Auth Flow**: Register a new admin -> Logout -> Login -> Verify Sidebar visible.
2.  **Product Flow**: Register a new SKU -> Check if "Registered Asset" shows in catalog.
3.  **Stock Flow**: Select Warehouse -> Add 100 units -> Check if Transaction Log shows "IN: 100".
4.  **Security Flow**: Attempt to access `/api/stock` without a token (should return 401).

---
*System Verified for Native Deployment v1.0.0*
