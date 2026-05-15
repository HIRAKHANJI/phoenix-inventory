# Update Log — Phoenix Inventory System

---

## 2026-03-19

- **Initial commit with CI pipeline** — Project scaffolding with GitHub Actions CI/CD pipeline setup. (`d418765`)
- **Fix CI lint errors** — Resolved linting issues blocking the CI pipeline. (`b17e373`)
- **Upgrade to corporate production standards** — Restructured backend to 3-tier architecture (controllers, services, repositories), added Helmet, rate limiting, CORS, Winston logging, and environment validation. (`9f0120a`)
- **Align JWT secrets and return 401 on invalid token** — Fixed JWT secret configuration across environments and standardized 401 responses for auth failures. (`cb33bb1`)
- **Show product name in stock notifications** — Enhanced notification messages to include product names instead of just IDs. (`a17f79f`)
- **Add PDF report download feature** — Added jsPDF-based PDF report generation for inventory and stock views. (`78cabd3`)

---

## 2026-03-30

- **Initial commit — Phoenix Inventory System** — Full system rebuild with React 19 frontend, Express backend, PostgreSQL database, multi-tenant support (Phoenix/Inpack), and Docker Compose setup. (`98dfb10`)

---

## 2026-04-01

- **Initial commit — Phoenix Inventory System (part 2)** — Continued system build-out with additional pages (AdminStock, AdminUsers, UserPanel), role-based routing, cross-company clearance grants, and notification system. (`89a5e11`)

---

## 2026-04-02

- **Final full system update** — Completed all core features: stock inbound/outbound transactions, CSV export, search/filtering, glassmorphic UI with Phoenix/Inpack theming, and sidebar navigation. (`c5860d4`)
- **Updated README and CI/CD pipeline** — Added architecture diagrams (Mermaid), setup instructions, and refined GitHub Actions workflows. (`a58c3bc`)
- **Updated CI/CD pipeline and fixed migrations** — Fixed database migration ordering, added idempotent checks, and updated CI to run migrations against a live PostgreSQL service. (`8fae850`, `e75c5af`)
- **Updated setup documentation** — Added SETUP.md with Windows/WSL2 instructions, TESTING_SEQUENCE.md with manual test plan, and ARCHITECTURE.md with ERD and deployment guide. (`4942582`)

---

## 2026-04-03

- **Upload project manual** — Added project documentation files via GitHub. (`c781cc5`)
- **Delete phoenix-inventory.pptx** — Removed uploaded presentation file. (`b907047`)
- **Project manual** — Added finalized project manual document. (`7d3556a`)

---

## 2026-04-04

- **Final update — DB restore, setup, CI/CD updates** — Added database backup/restore scripts, seed data for Impack tenant, schema cloning utility, and refined Docker Compose configuration with resource limits. (`0adb84a`, `bf35db5`)
- **Updated README** — Final README polish with updated badges and project description. (`f796f6f`)

---

## 2026-04-06

- **Git author rewrite** — Rewrote author/committer info on 8 commits to correct attribution. Force-pushed `main` and `claude/git-author-setup-IoSrq`.
- **Branch protection** — Enabled branch protection rules on `main`: require PR with 1 approval, dismiss stale reviews, block force pushes, restrict deletions.

---

## 2026-05-12

- **Database Infrastructure Migration** — Migrated Inpack operational database to `inpack_db` standard. Unified connection logic via `dbManager.js` and enforced strict tenant validation across manufacturing modules.
- **Terminology Simplification & UI Polish** — Overhauled the entire frontend to use clear, accessible language. Replaced corporate jargon ("Facility Node", "Personnel Registry", "Intelligence Report") with intuitive terms ("Warehouse", "User Management", "Inventory Report") for better accessibility.
- **Super Admin Typos & Security** — Standardized Super Admin identity to `superadmin@phoenix-pack.com`. Cleaned up authentication logic to ensure stable multi-tenant access.
- **System Cleanup & Optimization** — Purged over 15 redundant script files, diagnostic tools, and legacy migration helpers from the backend. Streamlined the repository structure for better maintainability.
- **Dynamic Multi-Currency Support** — Implemented region-specific currency formatting. Phoenix users now operate in **AED**, while Inpack users operate in **Rupees (₹)**, including locale-specific numbering formats.
- **User Registration Fix** — Resolved a database constraint error (`users_role_check`) by standardizing new registrations to use the `user` role with a `pending` status. Expanded the database constraint to include `viewer` and `pending` roles for future-proofing and backward compatibility.
- **Notification Visibility Control** — Restricted "New User Registration" alerts to Super Admins only. Implemented role-based notification filtering in the backend to ensure sensitive system alerts are only visible to authorized personnel.
- **System-Wide Visibility & Stability** — Optimized text contrast in Product and Stock management modules for both light and dark themes. Implemented robust search filtering with safety checks to prevent frontend crashes during data entry.
- **Stock Management Resilience** — Hardened the stock update backend to automatically resolve product IDs from names, preventing errors during manual stock adjustments.






---

## 2026-05-06

- **Manufacturing Stabilization & Stock Integrity** — Implemented automatic stock restoration on project deletion to prevent inventory loss. Enforced immutability for closed projects to maintain data audit trails.
- **Enhanced Quantity Precision** — Migrated stock and transaction schemas to `decimal(15, 2)` to support high-precision tracking for raw materials (kg, meters, etc.).
- **Premium UI Refinement (Manufacturing)** — Polished core metadata editing experience with consistent fields (budget, notes) across list and detail views. Fixed heading rendering bugs and implemented "System Calibration" terminology for industrial feel.


