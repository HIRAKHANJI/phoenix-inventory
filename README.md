# 🏷️ Phoenix Inventory: Enterprise Logistics Core

**Phoenix Inventory** is a high-performance, auditable, and multi-deployment inventory management system. Optimized for reliability, it serves as the central intelligence hub for organizational stock control and asset tracking.

---

## 🚀 Deployment Strategy: "Deploy Anywhere"

This system is engineered for maximum flexibility, supporting both modern containerization and traditional high-availability server environments.

### 🏢 Path A: Native Windows Server (Recommended for VPS)
Optimized for **Windows Server 2019/2022** without Docker overhead.
- **Process Manager**: PM2 (Process Manager 2)
- **Database**: PostgreSQL 15 Service
- **Access**: IP-based or Domain-mapped
- [See SETUP.md for Native Instructions](./SETUP.md#3-native-windows-server-production-setup)

### 🐳 Path B: Dockerized Logic
Ideal for development environments and Linux-based infrastructure.
- **Orchestration**: Docker Compose
- **Environment**: WSL2 (Windows) / Native Docker (Linux)
- [See SETUP.md for Docker Instructions](./SETUP.md#4-docker-setup-development)

---

## 🛠️ Technology Stack & Standards

- **Frontend**: React 18, Vite, Tailwind CSS (High-Performance UI).
- **Backend**: Node.js, Express, Knex.js (ACID-compliant transactions).
- **Security**: JWT Stateless Sessions, Bcrypt Hashing, Helmet Security Headers.
- **Database**: PostgreSQL 15 (Relational Data Integrity).
- **Process Management**: PM2 Cluster Mode.

---

## 🏗️ Architecture & Flows

The system utilizes a **Layered Architecture** (Controller -> Service -> Repository) to ensure business logic is isolated from delivery mechanisms.

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Explore the detailed system diagrams, ERD schema, and performance optimizations.
- **[TESTING_SEQUENCE.md](./TESTING_SEQUENCE.md)**: Review our comprehensive manual and automated verification protocols.

---

## 🧪 Verified Stability

Every release undergoes a rigorous testing sequence to ensure zero-regressions:
1.  **Functional Logic**: Verified via Jest/Supertest.
2.  **Deduplication**: Guaranteed SKU uniqueness at the DB constraint level.
3.  **Cascading Operations**: Clean deletion of related records (Non-stick logic).
4.  **Schema Consistency**: Automated Knex migrations.

---

## 🔧 Getting Started

1.  **Prerequisites**: Install Node.js 20+ and PostgreSQL 15.
2.  **Clone**: `git clone [repo-url]`
3.  **Setup**: Follow the **[SETUP.md](./SETUP.md)** instructions for your specific OS.
4.  **Verify**: Run `npm test` in the `/backend` to check logic integrity.

---
Verified & Documented for Production Release v1.0.0
